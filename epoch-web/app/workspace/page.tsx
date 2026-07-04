'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Sidebar from '@/components/Sidebar';
import NodeHeader from '@/components/NodeHeader';
import PdfPanel from '@/components/PdfPanel';
import CanvasPanel from '@/components/CanvasPanel';
import { listNodes, getNode, getManifest, updateNode, createNode } from '@/lib/api';
import type { NodeSummary } from '@/lib/api';

const Editor = dynamic(() => import('@/components/Editor'), { ssr: false });

type Tab = 'editor' | 'pdf' | 'canvas';

export default function WorkspacePage() {
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [nodeTitle, setNodeTitle] = useState('');
  const [nodeStatus, setNodeStatus] = useState('Sketch');
  const [latex, setLatex] = useState('');
  const [tab, setTab] = useState<Tab>('editor');
  const [workspaceName, setWorkspaceName] = useState('Epoch');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    getManifest()
      .then((m) => setWorkspaceName(m.name))
      .catch(() => {});
    loadNodes();
  }, []);

  async function loadNodes() {
    try {
      const ns = await listNodes();
      setNodes(ns);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load nodes');
    }
  }

  async function selectNode(path: string) {
    setSelectedPath(path);
    setLatex('');
    setSaveStatus('saved');
    try {
      const detail = await getNode(path);
      setLatex(detail.latex ?? '');
      setNodeTitle(detail.node.title ?? path);
      setNodeStatus(detail.node.status ?? 'Sketch');
    } catch {
      setLatex('% Failed to load node content');
    }
  }

  const handleSave = useCallback(async (value: string) => {
    if (!selectedPath) return;
    setSaveStatus('saving');
    try {
      await updateNode(selectedPath, value);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [selectedPath]);

  async function handleCreate(parentPath: string, title: string) {
    const created = await createNode(parentPath, title);
    await loadNodes();
    await selectNode(created.path);
  }

  function handleTitleChange(newTitle: string) {
    setNodeTitle(newTitle);
    setNodes((prev) => prev.map((n) => n.path === selectedPath ? { ...n, title: newTitle } : n));
  }

  function handleStatusChange(newStatus: string) {
    setNodeStatus(newStatus);
    setNodes((prev) => prev.map((n) => n.path === selectedPath ? { ...n, status: newStatus } : n));
  }

  async function handleDeleted() {
    setSelectedPath(null);
    setNodeTitle('');
    setNodeStatus('Sketch');
    setLatex('');
    await loadNodes();
  }

  async function handleRename(fromPath: string, toPath: string) {
    if (selectedPath === fromPath) {
      setSelectedPath(toPath);
    } else if (selectedPath?.startsWith(fromPath + '/')) {
      setSelectedPath(selectedPath.replace(fromPath, toPath));
    }
    await loadNodes();
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'editor', label: 'LaTeX' },
    { id: 'pdf', label: 'PDF' },
    { id: 'canvas', label: 'Canvas' },
  ];

  const statusLabel = { saved: 'Saved', saving: 'Saving…', unsaved: 'Unsaved', error: 'Error saving' }[saveStatus];
  const statusColor = { saved: 'var(--text-muted)', saving: 'var(--accent)', unsaved: 'var(--text-muted)', error: 'var(--error)' }[saveStatus];

  return (
    <div className="workspace">
      <Sidebar
        nodes={nodes}
        selectedPath={selectedPath}
        onSelect={selectNode}
        onCreate={handleCreate}
        onRename={handleRename}
        workspaceName={workspaceName}
      />

      <main className="main">
        <div className="topbar">
          <div className="tabs">
            {tabs.map((t) => (
              <button
                key={t.id}
                className={`tab${tab === t.id ? ' active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
          <div className="save-status" style={{ color: statusColor }}>
            {selectedPath ? statusLabel : ''}
          </div>
        </div>

        {selectedPath && (
          <NodeHeader
            path={selectedPath}
            title={nodeTitle}
            status={nodeStatus}
            onTitleChange={handleTitleChange}
            onStatusChange={handleStatusChange}
            onDeleted={handleDeleted}
          />
        )}

        <div className="panel">
          {loadError && (
            <div className="load-error">
              Bridge unreachable: {loadError}
            </div>
          )}
          {!selectedPath && !loadError && (
            <div className="select-prompt">Select a node from the sidebar</div>
          )}
          {selectedPath && tab === 'editor' && (
            <Editor
              value={latex}
              onChange={(v) => { setLatex(v); setSaveStatus('unsaved'); }}
              onSave={handleSave}
            />
          )}
          {selectedPath && tab === 'pdf' && (
            <PdfPanel latex={latex} />
          )}
          {tab === 'canvas' && (
            <CanvasPanel />
          )}
        </div>
      </main>

      <style>{`
        .workspace {
          display: flex;
          height: 100vh;
          overflow: hidden;
        }
        .main {
          flex: 1;
          display: flex;
          flex-direction: column;
          overflow: hidden;
          min-width: 0;
        }
        .topbar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 12px;
          border-bottom: 1px solid var(--border);
          background: var(--surface);
          flex-shrink: 0;
          height: 40px;
        }
        .tabs {
          display: flex;
          gap: 2px;
        }
        .tab {
          padding: 4px 14px;
          background: transparent;
          color: var(--text-muted);
          border-radius: 4px;
          font-size: 13px;
        }
        .tab:hover { background: var(--surface2); color: var(--text); }
        .tab.active { background: var(--surface2); color: var(--text); }
        .save-status {
          font-size: 12px;
          transition: color 0.2s;
        }
        .panel {
          flex: 1;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .select-prompt, .load-error {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--text-muted);
          font-size: 13px;
        }
        .load-error { color: var(--error); }
      `}</style>
    </div>
  );
}
