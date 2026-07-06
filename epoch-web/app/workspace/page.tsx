'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import AnalyticalLayout from '@/layouts/AnalyticalLayout';
import FocusLayout from '@/layouts/FocusLayout';
import NavigatorLayout from '@/layouts/NavigatorLayout';
import { listNodes, getNode, getManifest, updateNode, createNode, compileLatex, compileWorkspacePdf } from '@/lib/api';
import type { NodeSummary, ValidationPathEntry } from '@/lib/api';
import type { LayoutMode, ContentTab } from '@/layouts/types';
import type { SidebarMode } from '@/components/ActivityBar';

export default function WorkspacePage() {
  // Workspace
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [workspaceName, setWorkspaceName] = useState('Epoch');
  const [loadError, setLoadError] = useState<string | null>(null);

  // Selected node
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [nodeTitle, setNodeTitle] = useState('');
  const [nodeStatus, setNodeStatus] = useState('Sketch');
  const [nodeDescription, setNodeDescription] = useState('');
  const [nodeTags, setNodeTags] = useState<string[]>([]);
  const [nodeValidationPath, setNodeValidationPath] = useState<ValidationPathEntry[]>([]);
  const [latex, setLatex] = useState('');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved' | 'error'>('saved');

  // Compile state (lifted so all layouts can control it)
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compilingWorkspace, setCompilingWorkspace] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  // Layout state
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('analytical');
  const [contentTab, setContentTab] = useState<ContentTab>('editor');
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('nodes');

  const router = useRouter();

  useEffect(() => {
    getManifest().then((m) => setWorkspaceName(m.name)).catch(() => {});
    loadNodes();
  }, []);

  // Revoke blob URL on unmount
  useEffect(() => {
    return () => { if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current); };
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
      setNodeDescription(detail.node.description ?? '');
      setNodeTags(detail.node.tags ?? []);
      setNodeValidationPath(detail.node.validationPath ?? []);
    } catch {
      setLatex('% Failed to load node content');
    }
  }

  const handleSave = useCallback(async (value: string) => {
    if (!selectedPath) return;
    setSaveStatus('saving');
    try {
      await updateNode(selectedPath, { latex: value });
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
  }, [selectedPath]);

  const handleCompile = useCallback(async () => {
    if (!latex.trim()) return;
    setCompiling(true);
    setCompileError(null);
    try {
      const blob = await compileLatex(latex);
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);
      setContentTab('pdf');
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : String(err));
    } finally {
      setCompiling(false);
    }
  }, [latex]);

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
    setNodeDescription('');
    setNodeTags([]);
    setNodeValidationPath([]);
    setLatex('');
    setPdfUrl(null);
    pdfUrlRef.current = null;
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

  const handleCompileWorkspace = useCallback(async () => {
    setCompilingWorkspace(true);
    try {
      const blob = await compileWorkspacePdf();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${workspaceName}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      setCompileError(err instanceof Error ? err.message : String(err));
    } finally {
      setCompilingWorkspace(false);
    }
  }, [workspaceName]);

  function handleGoWorkspace() {
    setSelectedPath(null);
    setNodeTitle('');
    setNodeStatus('Sketch');
    setNodeDescription('');
    setNodeTags([]);
    setNodeValidationPath([]);
    setLatex('');
    setPdfUrl(null);
    if (pdfUrlRef.current) { URL.revokeObjectURL(pdfUrlRef.current); pdfUrlRef.current = null; }
    router.replace('/workspace', { scroll: false });
  }
  const lp = {
    workspaceName,
    nodes,
    selectedPath,
    nodeTitle,
    nodeStatus,
    nodeDescription,
    nodeTags,
    nodeValidationPath,
    latex,
    saveStatus,
    loadError,
    compiling,
    compilingWorkspace,
    pdfUrl,
    compileError,
    layoutMode,
    contentTab,
    panelOpen,
    sidebarMode,
    onSelect: selectNode,
    onCreate: handleCreate,
    onRename: handleRename,
    onDeleted: handleDeleted,
    onLatexChange: (v: string) => { setLatex(v); setSaveStatus('unsaved'); },
    onSave: handleSave,
    onCompile: handleCompile,
    onCompileWorkspace: handleCompileWorkspace,
    onSetContentTab: setContentTab,
    onTitleChange: handleTitleChange,
    onStatusChange: handleStatusChange,
    onDescriptionChange: setNodeDescription,
    onTagsChange: setNodeTags,
    onValidationPathChange: (vp: ValidationPathEntry[]) => {
      setNodeValidationPath(vp);
    },
    onSetLayout: setLayoutMode,
    onTogglePanel: () => setPanelOpen((v) => !v),
    onSetSidebarMode: setSidebarMode,
    onGoWorkspace: handleGoWorkspace,
  };

  if (layoutMode === 'focus') return <FocusLayout {...lp} />;
  if (layoutMode === 'navigator') return <NavigatorLayout {...lp} />;
  return <AnalyticalLayout {...lp} />;
}


