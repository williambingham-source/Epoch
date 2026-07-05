'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useState, useEffect, useCallback, useRef } from 'react';
import AnalyticalLayout from '@/layouts/AnalyticalLayout';
import FocusLayout from '@/layouts/FocusLayout';
import NavigatorLayout from '@/layouts/NavigatorLayout';
import {
  setApiBase,
  listNodes,
  getNode,
  getManifest,
  updateNode,
  createNode,
  compileLatex,
} from '@/lib/api';
import type { NodeSummary, ValidationPathEntry } from '@/lib/api';
import type { LayoutMode, ContentTab } from '@/layouts/types';
import type { SidebarMode } from '@/components/ActivityBar';

export default function WorkspacePage() {
  const { name } = useParams<{ name: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  // Point all api calls at /ws/<name>/api/*
  useEffect(() => {
    setApiBase(`/ws/${name}/api`);
    return () => setApiBase('/api');
  }, [name]);

  // Workspace
  const [nodes, setNodes] = useState<NodeSummary[]>([]);
  const [workspaceName, setWorkspaceName] = useState(name);
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

  // Compile
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [compiling, setCompiling] = useState(false);
  const [compileError, setCompileError] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  // Layout
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('analytical');
  const [contentTab, setContentTab] = useState<ContentTab>('editor');
  const [panelOpen, setPanelOpen] = useState(true);
  const [sidebarMode, setSidebarMode] = useState<SidebarMode>('nodes');

  // Whether we've already auto-selected the node from the URL on this workspace load
  const didAutoSelect = useRef(false);

  useEffect(() => {
    didAutoSelect.current = false;
    getManifest().then((m) => setWorkspaceName(m.name)).catch(() => {});
    loadNodes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [name]);

  useEffect(() => {
    return () => { if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current); };
  }, []);

  // Auto-select node from ?node= URL param after nodes are loaded
  useEffect(() => {
    if (didAutoSelect.current || nodes.length === 0 || selectedPath !== null) return;
    const nodeParam = searchParams.get('node');
    if (nodeParam) {
      didAutoSelect.current = true;
      selectNode(nodeParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

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
    // Reflect selection in the URL so the link is shareable / browser back works
    router.replace(`/ws/${name}?node=${encodeURIComponent(path)}`, { scroll: false });
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
    setNodes((prev) =>
      prev.map((n) => (n.path === selectedPath ? { ...n, title: newTitle } : n)),
    );
  }

  function handleStatusChange(newStatus: string) {
    setNodeStatus(newStatus);
    setNodes((prev) =>
      prev.map((n) => (n.path === selectedPath ? { ...n, status: newStatus } : n)),
    );
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
    // Clear node from URL
    router.replace(`/ws/${name}`, { scroll: false });
    await loadNodes();
  }

  async function handleRename(fromPath: string, toPath: string) {
    if (selectedPath === fromPath) {
      setSelectedPath(toPath);
      router.replace(`/ws/${name}?node=${encodeURIComponent(toPath)}`, { scroll: false });
    } else if (selectedPath?.startsWith(fromPath + '/')) {
      const newPath = selectedPath.replace(fromPath, toPath);
      setSelectedPath(newPath);
      router.replace(`/ws/${name}?node=${encodeURIComponent(newPath)}`, { scroll: false });
    }
    await loadNodes();
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
    onSetContentTab: setContentTab,
    onTitleChange: handleTitleChange,
    onStatusChange: handleStatusChange,
    onDescriptionChange: setNodeDescription,
    onTagsChange: setNodeTags,
    onValidationPathChange: (vp: ValidationPathEntry[]) => setNodeValidationPath(vp),
    onSetLayout: setLayoutMode,
    onTogglePanel: () => setPanelOpen((v) => !v),
    onSetSidebarMode: setSidebarMode,
  };

  if (layoutMode === 'focus') return <FocusLayout {...lp} />;
  if (layoutMode === 'navigator') return <NavigatorLayout {...lp} />;
  return <AnalyticalLayout {...lp} />;
}
