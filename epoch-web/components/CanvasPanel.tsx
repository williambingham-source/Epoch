'use client';

import { useEffect, useRef, useCallback, useState, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { useParams } from 'next/navigation';
import { getNodeCanvas, saveNodeCanvas, type ExcalidrawScene } from '../lib/api';
import EpochPanel from './EpochPanel';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyProps = Record<string, any>;

const ExcalidrawComponent: React.ComponentType<AnyProps> = dynamic(
  async () => {
    const { Excalidraw } = await import('@excalidraw/excalidraw');
    return { default: Excalidraw as React.ComponentType<AnyProps> };
  },
  { ssr: false },
) as React.ComponentType<AnyProps>;

class CanvasErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div className="canvas-message" style={{ flexDirection: 'column', gap: 8 }}>
          <span>Canvas failed to load</span>
          <span style={{ fontSize: 12, opacity: 0.6 }}>{this.state.error}</span>
        </div>
      );
    }
    return this.props.children;
  }
}

interface Props {
  nodePath: string | null;
}

export default function CanvasPanel({ nodePath }: Props) {
  const params = useParams();
  const workspaceName = typeof params?.name === 'string' ? params.name : '';

  const [initialData, setInitialData] = useState<ExcalidrawScene | null | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);

  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSceneRef = useRef<ExcalidrawScene | null>(null);
  // Prevents onChange → Yjs → observe → updateScene → onChange loop
  const isRemoteUpdate = useRef(false);
  // Yjs provider ref so we can destroy it on node change
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const yjsRef = useRef<{ provider: any; yElements: any; ydoc: any } | null>(null);

  const flushSave = useCallback(() => {
    if (saveTimerRef.current) {
      clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    if (nodePath && pendingSceneRef.current) {
      saveNodeCanvas(nodePath, pendingSceneRef.current).catch(() => {});
      pendingSceneRef.current = null;
    }
  }, [nodePath]);

  // Load saved canvas and set up Yjs when node changes
  useEffect(() => {
    if (!nodePath) {
      setInitialData(null);
      return;
    }

    setInitialData(undefined);

    getNodeCanvas(nodePath)
      .then((scene) => {
        if (!scene) { setInitialData(null); return; }
        const appState = scene.appState
          ? { ...scene.appState, collaborators: new Map() }
          : { collaborators: new Map() };
        setInitialData({ ...scene, appState });
      })
      .catch(() => setInitialData(null));

    // Set up Yjs collaboration
    let destroyed = false;
    const roomName = `${workspaceName}/${nodePath}`;
    const wsUrl = `ws://${window.location.hostname}:3004`;

    Promise.all([import('yjs'), import('y-websocket')]).then(([Y, { WebsocketProvider }]) => {
      if (destroyed) return;

      const ydoc = new Y.Doc();
      const provider = new WebsocketProvider(wsUrl, roomName, ydoc, { connect: true });
      const yElements = ydoc.getMap<string>('elements');

      yjsRef.current = { provider, yElements, ydoc };

      // Remote update → apply to Excalidraw
      yElements.observe(() => {
        if (!excalidrawAPI) return;
        const remoteElements = Array.from(yElements.values()).map((v) => {
          try { return JSON.parse(v); } catch { return null; }
        }).filter(Boolean);

        if (remoteElements.length === 0) return;

        isRemoteUpdate.current = true;
        excalidrawAPI.updateScene({ elements: remoteElements });
        isRemoteUpdate.current = false;
      });

    }).catch(() => { /* collab server unreachable — canvas still works solo */ });

    return () => {
      destroyed = true;
      flushSave();
      if (yjsRef.current) {
        yjsRef.current.provider.destroy();
        yjsRef.current.ydoc.destroy();
        yjsRef.current = null;
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodePath, workspaceName]);

  // Re-attach observe when excalidrawAPI becomes available
  useEffect(() => {
    if (!excalidrawAPI || !yjsRef.current) return;
    const { yElements } = yjsRef.current;

    const handler = () => {
      const remoteElements = Array.from(yElements.values()).map((v) => {
        try { return JSON.parse(v as string); } catch { return null; }
      }).filter(Boolean);

      if (remoteElements.length === 0) return;
      isRemoteUpdate.current = true;
      excalidrawAPI.updateScene({ elements: remoteElements });
      isRemoteUpdate.current = false;
    };

    yElements.observe(handler);
    return () => yElements.unobserve(handler);
  }, [excalidrawAPI]);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (!nodePath) return;

      // Persist to disk
      pendingSceneRef.current = {
        elements: elements as unknown[],
        appState: appState as Record<string, unknown>,
        files: files as Record<string, unknown>,
      };
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        if (nodePath && pendingSceneRef.current) {
          saveNodeCanvas(nodePath, pendingSceneRef.current).catch(() => {});
          pendingSceneRef.current = null;
        }
        saveTimerRef.current = null;
      }, 2000);

      // Sync to Yjs (skip if this change was triggered by a remote update)
      if (isRemoteUpdate.current || !yjsRef.current) return;
      const { yElements, ydoc } = yjsRef.current;

      ydoc.transact(() => {
        const currentIds = new Set((elements as { id: string }[]).map((el) => el.id));
        // Remove deleted elements
        for (const id of Array.from(yElements.keys() as Iterable<string>)) {
          if (!currentIds.has(id)) yElements.delete(id);
        }
        // Add / update elements
        for (const el of elements as { id: string }[]) {
          const serialized = JSON.stringify(el);
          if (yElements.get(el.id) !== serialized) {
            yElements.set(el.id, serialized);
          }
        }
      });
    },
    [nodePath],
  );

  if (!nodePath) {
    return (
      <div className="canvas-message">
        <span>Select a node to open its canvas</span>
        <style>{styles}</style>
      </div>
    );
  }

  if (initialData === undefined) {
    return (
      <div className="canvas-message">
        <span>Loading canvas…</span>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <CanvasErrorBoundary>
      <div className="canvas-panel">
        <div className="canvas-main">
          <ExcalidrawComponent
            initialData={initialData ?? undefined}
            onChange={handleChange}
            excalidrawAPI={setExcalidrawAPI}
            theme="dark"
            UIOptions={{ canvasActions: { export: false, loadScene: true, saveToActiveFile: false } }}
          />
        </div>
        <EpochPanel api={excalidrawAPI} nodePath={nodePath} />
      </div>
      <style>{styles}</style>
    </CanvasErrorBoundary>
  );
}

const styles = `
  .canvas-panel {
    position: relative;
    display: flex;
    flex-direction: row;
    width: 100%;
    height: 100%;
    overflow: hidden;
  }
  .canvas-main {
    flex: 1;
    min-width: 0;
    position: relative;
    height: 100%;
  }
  .canvas-main > div { width: 100%; height: 100%; }
  .canvas-message { display:flex; align-items:center; justify-content:center; height:100%; color:#6c7086; font-size:14px; }
`;
