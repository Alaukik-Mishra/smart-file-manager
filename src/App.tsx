import { useState, useEffect, useMemo, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

// ── TYPES ──────────────────────────────────────────────────────

interface FileMeta {
  path: string; size: number; modified: string;
  hash: string; name: string; category: string;
}

interface DeletedEntry {
  hash: string; path: string; name: string;
  size: number; category: string;
  deleted_at: number; snapshot_name: string;
}

interface SnapshotInfo {
  name: string; timestamp: number;
  file_count: number; folder_path: string;
}

interface FileProperties {
  path: string; name: string; size: number; hash: string;
  modified: string; category: string; exists_on_disk: boolean;
}

interface ContextMenu {
  x: number; y: number;
  item: { hash: string | null; path: string; name: string; isFolder: boolean; folderPath?: string };
}

// ── SVG ICONS ─────────────────────────────────────────────────

const Icon = {
  Folder: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/>
    </svg>
  ),
  Image: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/>
      <polyline points="21 15 16 10 5 21"/>
    </svg>
  ),
  Video: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="4" width="15" height="16" rx="2"/>
      <polygon points="17 9 22 12 17 15 17 9"/>
    </svg>
  ),
  Document: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
      <polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/>
      <line x1="8" y1="17" x2="13" y2="17"/>
    </svg>
  ),
  Audio: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
    </svg>
  ),
  Archive: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="4" rx="1"/>
      <path d="M4 7v13a1 1 0 001 1h14a1 1 0 001-1V7"/>
      <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
    </svg>
  ),
  Exe: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2"/>
      <polyline points="8 17 12 13 8 9"/><line x1="14" y1="17" x2="16" y2="17"/>
    </svg>
  ),
  File: () => (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/>
      <polyline points="13 2 13 9 20 9"/>
    </svg>
  ),
  Trash: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/>
      <path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
    </svg>
  ),
  History: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/>
      <path d="M3.51 15a9 9 0 102.13-9.36L1 10"/>
    </svg>
  ),
  Snapshot: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
      <circle cx="12" cy="13" r="4"/>
    </svg>
  ),
  Close: () => (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
    </svg>
  ),
  ChevronRight: () => (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="9 18 15 12 9 6"/>
    </svg>
  ),
};

const categoryIcon = (cat: string) => {
  switch (cat) {
    case "image":      return <Icon.Image />;
    case "video":      return <Icon.Video />;
    case "document":   return <Icon.Document />;
    case "audio":      return <Icon.Audio />;
    case "archive":    return <Icon.Archive />;
    case "executable": return <Icon.Exe />;
    default:           return <Icon.File />;
  }
};

const categoryColor: Record<string, string> = {
  image: "#38bdf8", video: "#a78bfa", document: "#6ee7b7",
  audio: "#fb923c", archive: "#fbbf24", executable: "#f87171", other: "#94a3b8",
};

// ── HELPERS ────────────────────────────────────────────────────

const formatSize = (b: number) => {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(2) + " MB";
  return (b / 1073741824).toFixed(2) + " GB";
};

const formatTime = (ts: number) => new Date(ts * 1000).toLocaleString();

function getCategoryFromPath(path: string): string {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  if (["jpg","jpeg","png","gif","webp","bmp","svg"].includes(ext)) return "image";
  if (["mp4","mkv","mov","avi","wmv","webm"].includes(ext)) return "video";
  if (["pdf","doc","docx","txt","xlsx","csv","pptx"].includes(ext)) return "document";
  if (["mp3","wav","flac","aac","ogg"].includes(ext)) return "audio";
  if (["zip","rar","7z","tar","gz"].includes(ext)) return "archive";
  return "other";
}

// ── MODAL ─────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose}><Icon.Close /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── APP ───────────────────────────────────────────────────────

export default function App() {
  const [allFiles, setAllFiles]       = useState<[string, string][]>([]);
  const [currentPath, setCurrentPath] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType]   = useState("all");
  const [viewMode, setViewMode]       = useState<"browser" | "duplicates" | "history" | "snapshots">("browser");
  const [status, setStatus]           = useState("Ready");

  const [deleted, setDeleted]     = useState<DeletedEntry[]>([]);
  const [snapshots, setSnapshots] = useState<SnapshotInfo[]>([]);

  const [properties, setProperties]       = useState<FileProperties | null>(null);
  const [folderProps, setFolderProps]     = useState<{ name: string; path: string; fileCount: number; totalSize: number } | null>(null);
  const [contextMenu, setContextMenu]     = useState<ContextMenu | null>(null);

  // Modals
  const [renameModal, setRenameModal]         = useState<{ hash: string; currentName: string } | null>(null);
  const [renameFolderModal, setRenameFolderModal] = useState<{ oldName: string; path: string } | null>(null);
  const [indexModal, setIndexModal]           = useState<{ folderPath: string } | null>(null);
  const [snapshotNameInput, setSnapshotNameInput] = useState("");
  const [renameInput, setRenameInput]         = useState("");

  const contextRef = useRef<HTMLDivElement>(null);

  // ── DATA ────────────────────────────────────────────────────

  const refreshVault = async () => {
    try {
      const items = await invoke("get_all_stored_files") as [string, string][];
      setAllFiles(items);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const refreshHistory = async () => {
    try {
      const d = await invoke("get_deleted_files") as DeletedEntry[];
      setDeleted(d);
      const s = await invoke("get_snapshots") as SnapshotInfo[];
      setSnapshots(s);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  useEffect(() => { refreshVault(); refreshHistory(); }, []);
  useEffect(() => {
    const h = () => setContextMenu(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  // ── COMPUTED ────────────────────────────────────────────────

  const parsedFiles = useMemo(() =>
    allFiles.map(([hash, json]) => {
      try {
        const m = JSON.parse(json);
        return { ...m, hash, name: m.path.split(/[\\/]/).pop() || m.path } as FileMeta;
      } catch { return null; }
    }).filter(f => f && (filterType === "all" || f.category === filterType)) as FileMeta[],
  [allFiles, filterType]);

  const duplicateGroups = useMemo(() => {
    const g: Record<string, FileMeta[]> = {};
    parsedFiles.forEach(f => { if (!g[f.hash]) g[f.hash] = []; g[f.hash].push(f); });
    return Object.values(g).filter(arr => arr.length > 1);
  }, [parsedFiles]);

  const browserItems = useMemo(() => {
    const map = new Map<string, any>();
    const q = searchQuery.toLowerCase();
    parsedFiles.forEach(f => {
      const parts = f.path.split(/[\\/]/).filter(Boolean);
      if (q) {
        if (f.name.toLowerCase().includes(q)) map.set(f.hash, { ...f, isFolder: false });
      } else {
        const under = currentPath.every((p, i) => parts[i] === p);
        if (under && parts.length > currentPath.length) {
          const name = parts[currentPath.length];
          const isFolder = parts.length > currentPath.length + 1;
          const key = isFolder ? `dir-${name}` : f.hash;
          if (!map.has(key)) {
            const folderFullPath = isFolder
              ? parts.slice(0, currentPath.length + 1).join("/")
              : f.path;
            map.set(key, { name, isFolder, hash: isFolder ? null : f.hash, path: f.path, category: f.category, folderPath: folderFullPath });
          }
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => Number(b.isFolder) - Number(a.isFolder));
  }, [parsedFiles, currentPath, searchQuery]);

  // ── ACTIONS ─────────────────────────────────────────────────

  const handleIndexFolder = async () => {
    const folder = await open({ directory: true });
    if (!folder) return;
    setIndexModal({ folderPath: folder as string });
    const defaultName = new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    setSnapshotNameInput(defaultName);
  };

  const confirmIndex = async () => {
    if (!indexModal) return;
    const name = snapshotNameInput.trim() ||
      new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    setIndexModal(null);
    setStatus("Indexing...");
    try {
      const result = await invoke<string>("start_auto_scan", {
        folderPath: indexModal.folderPath, snapshotName: name,
      });
      await refreshVault();
      await refreshHistory();
      setStatus(result);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const handleOpenFile = async (path: string) => {
    const exists = await invoke<boolean>("check_file_status", { path });
    if (exists) await invoke("open_file", { path });
    else alert("Ghost File: This file is not on the current drive.\n\nThe drive or device may be unplugged.");
  };

  const handleDeleteFile = async (hash: string, path: string) => {
    if (!confirm(`Permanently delete from disk?\n\n${path}\n\nThis cannot be undone.`)) return;
    try {
      await invoke("delete_physical_file", { hash, path });
      await refreshVault(); await refreshHistory();
      if (properties?.hash === hash) setProperties(null);
      setStatus("File deleted and recorded in history.");
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const handleShowFileProperties = async (hash: string) => {
    try {
      const p = await invoke<FileProperties>("get_file_properties", { hash });
      setProperties(p);
      setFolderProps(null);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const handleShowFolderProperties = (item: any) => {
    const folderPath = item.folderPath || item.name;
    const norm = folderPath.replace(/\\/g, "/").toLowerCase();
    const children = parsedFiles.filter(f =>
      f.path.replace(/\\/g, "/").toLowerCase().startsWith(norm + "/") ||
      f.path.replace(/\\/g, "/").toLowerCase().includes("/" + item.name.toLowerCase() + "/")
    );
    const totalSize = children.reduce((acc, f) => acc + f.size, 0);
    setFolderProps({ name: item.name, path: folderPath, fileCount: children.length, totalSize });
    setProperties(null);
  };

  const handleRename = async () => {
    if (!renameModal || !renameInput.trim()) return;
    try {
      await invoke("rename_in_index", { hash: renameModal.hash, newName: renameInput.trim() });
      await refreshVault();
      setRenameModal(null);
      setRenameInput("");
      setStatus("Renamed.");
      if (properties?.hash === renameModal.hash) handleShowFileProperties(renameModal.hash);
    } catch (e) { alert(`Rename failed: ${e}`); }
  };

  const handleDeleteSnapshot = async (snap: SnapshotInfo) => {
    if (!confirm(`Delete snapshot record "${snap.name}"?\n\nThis only removes the snapshot record, not your actual files.`)) return;
    await invoke("delete_snapshot", { snapshotName: snap.name, timestamp: snap.timestamp });
    await refreshHistory();
    setStatus(`Snapshot "${snap.name}" deleted.`);
  };

  const handleContextMenu = (e: React.MouseEvent, item: ContextMenu["item"]) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, item });
  };

  // ── RENDER ──────────────────────────────────────────────────

  return (
    <div className="app-container" onClick={() => setContextMenu(null)}>
      <div className="main-layout">

        {/* SIDEBAR */}
        <aside className="sidebar">
          <div className="app-logo">
            <span className="logo-icon">◈</span> VAULT
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">LIBRARY</div>
            {[
              { key: "all",      label: "Everything",  icon: "◉" },
              { key: "image",    label: "Images",      icon: "◫" },
              { key: "video",    label: "Videos",      icon: "▷" },
              { key: "document", label: "Documents",   icon: "≡" },
              { key: "audio",    label: "Audio",       icon: "♪" },
              { key: "archive",  label: "Archives",    icon: "⊞" },
            ].map(({ key, label, icon }) => (
              <div key={key}
                className={`sidebar-item ${filterType === key && viewMode === "browser" ? "active" : ""}`}
                onClick={() => { setFilterType(key); setViewMode("browser"); setSearchQuery(""); setCurrentPath([]); }}>
                <span className="sidebar-icon">{icon}</span>
                {label}
                {key === "all" && parsedFiles.length > 0 &&
                  <span className="sidebar-count">{parsedFiles.length}</span>}
              </div>
            ))}
          </div>

          <div className="sidebar-section">
            <div className="sidebar-label">TOOLS</div>
            <div className={`sidebar-item ${viewMode === "duplicates" ? "active" : ""}`}
              onClick={() => setViewMode("duplicates")}>
              <span className="sidebar-icon">⊗</span> Duplicates
              {duplicateGroups.length > 0 && <span className="badge-warn">{duplicateGroups.length}</span>}
            </div>
            <div className={`sidebar-item ${viewMode === "history" ? "active" : ""}`}
              onClick={() => { setViewMode("history"); refreshHistory(); }}>
              <span className="sidebar-icon"><Icon.History /></span> Deleted
              {deleted.length > 0 && <span className="badge-warn">{deleted.length}</span>}
            </div>
            <div className={`sidebar-item ${viewMode === "snapshots" ? "active" : ""}`}
              onClick={() => { setViewMode("snapshots"); refreshHistory(); }}>
              <span className="sidebar-icon"><Icon.Snapshot /></span> Snapshots
              {snapshots.length > 0 && <span className="sidebar-count">{snapshots.length}</span>}
            </div>
          </div>
        </aside>

        {/* CONTENT */}
        <section className="content-area">
          <header className="top-bar">
            <div className="toolbar">
              <button className="btn-primary" onClick={handleIndexFolder}>
                + Index Folder
              </button>
              <div className="search-wrap">
                <span className="search-icon"><Icon.Search /></span>
                <input className="search-input" placeholder="Search files..."
                  value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
              </div>
              <button className="btn-ghost" onClick={async () => {
                if (confirm("Reset entire vault index? Snapshots and history will be preserved.")) {
                  await invoke("clear_vault");
                  await refreshVault();
                  setCurrentPath([]);
                  setProperties(null);
                  setFolderProps(null);
                }
              }}>Reset</button>
            </div>
            {viewMode === "browser" && searchQuery === "" && (
              <nav className="breadcrumb">
                <span className="crumb-home" onClick={() => setCurrentPath([])}>Vault</span>
                {currentPath.map((p, i) => (
                  <span key={i} className="crumb-seg">
                    <Icon.ChevronRight />
                    <span onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}>{p}</span>
                  </span>
                ))}
              </nav>
            )}
          </header>

          <main className="file-grid">

            {/* BROWSER */}
            {viewMode === "browser" && (
              <>
                {browserItems.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon"><Icon.Folder /></div>
                    <p>Nothing indexed yet</p>
                    <button className="btn-primary" onClick={handleIndexFolder}>+ Index Folder</button>
                  </div>
                )}
                {browserItems.map(item => (
                  <div key={item.isFolder ? `dir-${item.name}` : item.hash}
                    className="grid-card"
                    style={!item.isFolder ? { "--cat-color": categoryColor[item.category] || "#94a3b8" } as any : {}}
                    onClick={() => !item.isFolder && item.hash && handleShowFileProperties(item.hash)}
                    onDoubleClick={() => item.isFolder
                      ? setCurrentPath([...currentPath, item.name])
                      : handleOpenFile(item.path)}
                    onContextMenu={e => handleContextMenu(e, item)}>
                    <div className={`card-icon-wrap ${item.isFolder ? "folder" : item.category}`}>
                      {item.isFolder ? <Icon.Folder /> : categoryIcon(item.category)}
                    </div>
                    <div className="item-name" title={item.name}>{item.name}</div>
                    {!item.isFolder && (
                      <div className="card-meta">
                        {formatSize(parsedFiles.find(f => f.hash === item.hash)?.size || 0)}
                      </div>
                    )}
                  </div>
                ))}
              </>
            )}

            {/* DUPLICATES */}
            {viewMode === "duplicates" && (
              <div className="full-panel">
                <div className="panel-title">Duplicate Files — {duplicateGroups.length} groups</div>
                {duplicateGroups.length === 0 && (
                  <div className="empty-state"><div className="empty-icon">✓</div><p>No duplicates found</p></div>
                )}
                {duplicateGroups.map((group, i) => (
                  <div key={i} className="dup-group">
                    <div className="dup-header">
                      <span className="dup-hash">{group[0].hash.substring(0, 20)}…</span>
                      <span className="dup-info">{group.length} copies · {formatSize(group[0].size)}</span>
                    </div>
                    {group.map((f, j) => (
                      <div key={j} className="list-row">
                        <span className="row-icon">{categoryIcon(f.category)}</span>
                        <span className="row-path" onClick={() => handleOpenFile(f.path)} title={f.path}>{f.path}</span>
                        <div className="row-actions">
                          <button className="btn-xs" onClick={() => handleShowFileProperties(f.hash)}>Info</button>
                          <button className="btn-xs red" onClick={() => handleDeleteFile(f.hash, f.path)}>
                            <Icon.Trash /> Delete
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {/* HISTORY — DELETED ONLY */}
            {viewMode === "history" && (
              <div className="full-panel">
                <div className="panel-title">
                  Deleted Files — {deleted.length} records
                  {deleted.length > 0 && (
                    <button className="btn-xs" style={{ marginLeft: "auto" }}
                      onClick={async () => {
                        if (confirm("Clear all deletion records?")) {
                          await invoke("clear_deleted_history");
                          await refreshHistory();
                        }
                      }}>Clear All</button>
                  )}
                </div>
                {deleted.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon"><Icon.Trash /></div>
                    <p>No deleted files recorded yet</p>
                    <p className="empty-sub">When you delete a file through this app, it appears here</p>
                  </div>
                )}
                {deleted.map((entry, i) => (
                  <div key={i} className="list-row deleted-row">
                    <span className="row-icon" style={{ color: "#f87171" }}>
                      {categoryIcon(entry.category)}
                    </span>
                    <div className="row-info">
                      <div className="row-name">{entry.name}</div>
                      <div className="row-subpath" title={entry.path}>{entry.path}</div>
                    </div>
                    <div className="row-meta-col">
                      <span className="row-size">{formatSize(entry.size)}</span>
                      <span className="row-time">{formatTime(entry.deleted_at)}</span>
                      {entry.snapshot_name !== "manual" && (
                        <span className="row-snap">from: {entry.snapshot_name}</span>
                      )}
                    </div>
                    <div className="deleted-note">
                      Gone from disk
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* SNAPSHOTS */}
            {viewMode === "snapshots" && (
              <div className="full-panel">
                <div className="panel-title">
                  Snapshots — {snapshots.length} saved
                </div>
                <div className="snapshot-explain">
                  A snapshot is automatically saved every time you click <strong>Index Folder</strong>. It records which files existed at that moment.
                </div>
                {snapshots.length === 0 && (
                  <div className="empty-state">
                    <div className="empty-icon"><Icon.Snapshot /></div>
                    <p>No snapshots yet</p>
                    <p className="empty-sub">Click "Index Folder" to create your first snapshot</p>
                  </div>
                )}
                {snapshots.map((snap, i) => (
                  <div key={i} className="snap-card">
                    <div className="snap-icon"><Icon.Snapshot /></div>
                    <div className="snap-info">
                      <div className="snap-name">{snap.name}</div>
                      <div className="snap-meta">{snap.file_count} files · {formatTime(snap.timestamp)}</div>
                      <div className="snap-folder" title={snap.folder_path}>{snap.folder_path}</div>
                    </div>
                    <div className="snap-actions">
                      <button className="btn-xs red" onClick={() => handleDeleteSnapshot(snap)}>
                        <Icon.Trash /> Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </main>
        </section>

        {/* PROPERTIES PANEL */}
        {(properties || folderProps) && (
          <aside className="props-panel">
            <div className="props-header">
              <span>PROPERTIES</span>
              <button className="icon-btn" onClick={() => { setProperties(null); setFolderProps(null); }}>
                <Icon.Close />
              </button>
            </div>

            {properties && (
              <>
                <div className="props-icon-wrap" style={{ color: categoryColor[properties.category] }}>
                  {categoryIcon(properties.category)}
                </div>
                <div className="props-name">{properties.name}</div>
                <div className={`props-status ${properties.exists_on_disk ? "on" : "off"}`}>
                  {properties.exists_on_disk ? "● On Disk" : "○ Not on Disk"}
                </div>
                <div className="props-rows">
                  <div className="prop-row"><span>Size</span><span>{formatSize(properties.size)}</span></div>
                  <div className="prop-row"><span>Type</span><span>{properties.category}</span></div>
                  <div className="prop-row"><span>Modified</span><span>{properties.modified.replace("Some(", "").replace(")", "")}</span></div>
                  <div className="prop-row"><span>Hash</span><span className="mono" title={properties.hash}>{properties.hash.substring(0, 20)}…</span></div>
                  <div className="prop-row"><span>Path</span><span className="path-wrap" title={properties.path}>{properties.path}</span></div>
                </div>
                <div className="props-btns">
                  <button className="btn-primary w100" onClick={() => handleOpenFile(properties.path)}>Open File</button>
                  <button className="btn-outline w100" onClick={() => {
                    setRenameInput(properties.name);
                    setRenameModal({ hash: properties.hash, currentName: properties.name });
                  }}>Rename</button>
                  <button className="btn-outline red w100" onClick={() => handleDeleteFile(properties.hash, properties.path)}>
                    Delete from Disk
                  </button>
                </div>
              </>
            )}

            {folderProps && (
              <>
                <div className="props-icon-wrap" style={{ color: "#facc15" }}>
                  <Icon.Folder />
                </div>
                <div className="props-name">{folderProps.name}</div>
                <div className="props-rows">
                  <div className="prop-row"><span>Files</span><span>{folderProps.fileCount}</span></div>
                  <div className="prop-row"><span>Total Size</span><span>{formatSize(folderProps.totalSize)}</span></div>
                  <div className="prop-row"><span>Path</span><span className="path-wrap" title={folderProps.path}>{folderProps.path}</span></div>
                </div>
              </>
            )}
          </aside>
        )}
      </div>

      {/* STATUS BAR */}
      <footer className="status-bar">
        <span className="status-msg">{status}</span>
        <span className="status-sep">·</span>
        <span>{parsedFiles.length} files</span>
        <span className="status-sep">·</span>
        <span>{duplicateGroups.length} duplicate groups</span>
        <span className="status-sep">·</span>
        <span>{deleted.length} deleted records</span>
      </footer>

      {/* CONTEXT MENU */}
      {contextMenu && (
        <div ref={contextRef} className="ctx-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={e => e.stopPropagation()}>
          {contextMenu.item.isFolder ? (
            <>
              <div className="ctx-row" onClick={() => {
                setCurrentPath([...currentPath, contextMenu.item.name]);
                setContextMenu(null);
              }}>Open</div>
              <div className="ctx-row" onClick={() => {
                handleShowFolderProperties(contextMenu.item);
                setContextMenu(null);
              }}>Properties</div>
            </>
          ) : (
            <>
              <div className="ctx-row" onClick={() => { handleOpenFile(contextMenu.item.path); setContextMenu(null); }}>
                Open
              </div>
              <div className="ctx-row" onClick={() => {
                if (contextMenu.item.hash) handleShowFileProperties(contextMenu.item.hash);
                setContextMenu(null);
              }}>Properties</div>
              <div className="ctx-row" onClick={() => {
                if (contextMenu.item.hash) {
                  setRenameInput(contextMenu.item.name);
                  setRenameModal({ hash: contextMenu.item.hash, currentName: contextMenu.item.name });
                }
                setContextMenu(null);
              }}>Rename</div>
              <div className="ctx-sep" />
              <div className="ctx-row red" onClick={() => {
                if (contextMenu.item.hash) handleDeleteFile(contextMenu.item.hash, contextMenu.item.path);
                setContextMenu(null);
              }}>Delete from Disk</div>
            </>
          )}
        </div>
      )}

      {/* RENAME MODAL */}
      {renameModal && (
        <Modal title="Rename File" onClose={() => setRenameModal(null)}>
          <div className="modal-field">
            <label>New filename</label>
            <input className="modal-input" value={renameInput}
              onChange={e => setRenameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleRename()}
              autoFocus />
          </div>
          <div className="modal-footer">
            <button className="btn-ghost" onClick={() => setRenameModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={handleRename}>Rename</button>
          </div>
        </Modal>
      )}

      {/* INDEX + SNAPSHOT NAME MODAL */}
      {indexModal && (
        <Modal title="Index Folder" onClose={() => setIndexModal(null)}>
          <p className="modal-folder-path">{indexModal.folderPath}</p>
          <div className="modal-field">
            <label>Snapshot name</label>
            <input className="modal-input"
              placeholder="e.g. before-cleanup, work-project-v2..."
              value={snapshotNameInput}
              onChange={e => setSnapshotNameInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && confirmIndex()}
              autoFocus />
            <small className="modal-hint">
              A snapshot of this folder will be saved automatically with this name so you can track what was deleted in future scans.
            </small>
          </div>
          <div className="modal-footer">
            <button className="btn-ghost" onClick={() => setIndexModal(null)}>Cancel</button>
            <button className="btn-primary" onClick={confirmIndex}>Start Indexing</button>
          </div>
        </Modal>
      )}
    </div>
  );
}