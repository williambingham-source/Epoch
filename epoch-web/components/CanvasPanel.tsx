'use client';

import { useEffect, useRef, useCallback, useState, Component, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { getNodeCanvas, saveNodeCanvas, type ExcalidrawScene } from '../lib/api';
import EpochPanel from './EpochPanel';

// Minimal prop type so TypeScript doesn't complain; Excalidraw types are complex
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
  const [initialData, setInitialData] = useState<ExcalidrawScene | null | undefined>(undefined);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [excalidrawAPI, setExcalidrawAPI] = useState<any>(null);
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSceneRef = useRef<ExcalidrawScene | null>(null);

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

  useEffect(() => {
    if (!nodePath) {
      setInitialData(null);
      return;
    }
    setInitialData(undefined);
    getNodeCanvas(nodePath)
      .then((scene) => {
        if (!scene) { setInitialData(null); return; }
        // collaborators is a Map in Excalidraw but serialises to {} in JSON — restore it
        const appState = scene.appState
          ? { ...scene.appState, collaborators: new Map() }
          : { collaborators: new Map() };
        setInitialData({ ...scene, appState });
      })
      .catch(() => setInitialData(null));

    return () => { flushSave(); };
  }, [nodePath, flushSave]);

  const handleChange = useCallback(
    (elements: readonly unknown[], appState: unknown, files: unknown) => {
      if (!nodePath) return;
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
