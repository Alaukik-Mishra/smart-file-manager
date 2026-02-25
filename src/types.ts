export interface FileMeta {
  path: string;
  size: number;
  modified: string;
  hash: string;
  name: string;
  category: string;
}

export interface DeletedEntry {
  hash: string;
  path: string;
  name: string;
  size: number;
  category: string;
  deleted_at: number;
  snapshot_name: string;
}

export interface SnapshotInfo {
  name: string;
  timestamp: number;
  file_count: number;
  folder_path: string;
}

export interface FileProperties {
  path: string;
  name: string;
  size: number;
  hash: string;
  modified: string;
  category: string;
  exists_on_disk: boolean;
}

export interface FolderProperties {
  path: string;
  name: string;
  file_count: number;
  total_size: number;
  exists_on_disk: boolean;
}

export interface CtxItem {
  hash: string | null;
  path: string;
  name: string;
  isFolder: boolean;
  folderPath?: string;
  category?: string;
}

export interface CtxMenu {
  x: number;
  y: number;
  item: CtxItem;
}

export interface NearDuplicateGroup {
  representative: FileMeta;
  similar: FileMeta[];
  similarity_pct: number;
}

export interface TimelineEntry {
  date: string;        // "2025-06-14"
  displayDate: string; // "June 14, 2025"
  files: FileMeta[];
}

export type PanelInfo =
  | { type: "file";   data: FileProperties }
  | { type: "folder"; data: FolderProperties };

export type ViewMode = "browser" | "duplicates" | "smartdup" | "history" | "snapshots" | "timeline";

export interface AppActions {
  handleOpen:               (path: string) => Promise<void>;
  handleDeleteToBin:        (hash: string, path: string) => Promise<void>;
  handleDeleteFolderToBin:  (folderPath: string) => Promise<void>;
  handlePermanentDelete:    (hash: string, path: string) => Promise<void>;
  handleCut:                (item: CtxItem) => void;
  handleCompress:           (paths: string[]) => void;
  handleExtract:            (zipPath: string) => Promise<void>;
  showFileProps:            (hash: string) => Promise<void>;
  showFolderProps:          (folderPath: string) => Promise<void>;
  setRenameModal:           (v: { hash: string|null; path: string; currentName: string; isFolder: boolean } | null) => void;
  setRenameInput:           (v: string) => void;
  setOpenWithModal:         (v: { path: string } | null) => void;
  setPasteModal:            (v: boolean) => void;
}