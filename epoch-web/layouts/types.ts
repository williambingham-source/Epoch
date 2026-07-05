import type { NodeSummary } from '@/lib/api';
import type { SidebarMode } from '@/components/ActivityBar';

export type LayoutMode = 'analytical' | 'focus' | 'navigator';
export type ContentTab = 'editor' | 'pdf' | 'canvas';

export interface LayoutProps {
  // workspace
  workspaceName: string;
  nodes: NodeSummary[];
  selectedPath: string | null;
  // current node
  nodeTitle: string;
  nodeStatus: string;
  nodeDescription: string;
  nodeTags: string[];
  latex: string;
  saveStatus: 'saved' | 'saving' | 'unsaved' | 'error';
  loadError: string | null;
  // compile
  compiling: boolean;
  pdfUrl: string | null;
  compileError: string | null;
  // ui state
  layoutMode: LayoutMode;
  contentTab: ContentTab;
  panelOpen: boolean;
  sidebarMode: SidebarMode;
  // node handlers
  onSelect: (path: string) => void;
  onCreate: (parentPath: string, title: string) => Promise<void>;
  onRename: (fromPath: string, toPath: string) => Promise<void>;
  onDeleted: () => void;
  // content handlers
  onLatexChange: (v: string) => void;
  onSave: (v: string) => Promise<void>;
  onCompile: () => void;
  onSetContentTab: (tab: ContentTab) => void;
  // metadata handlers
  onTitleChange: (t: string) => void;
  onStatusChange: (s: string) => void;
  onDescriptionChange: (d: string) => void;
  onTagsChange: (t: string[]) => void;
  // layout handlers
  onSetLayout: (mode: LayoutMode) => void;
  onTogglePanel: () => void;
  onSetSidebarMode: (m: SidebarMode) => void;
}
