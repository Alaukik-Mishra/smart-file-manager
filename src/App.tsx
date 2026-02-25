import { useState, useEffect, useMemo } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";

// Components
import Sidebar        from "./components/Sidebar";
import Toolbar        from "./components/Toolbar";
import FileGrid       from "./components/FileGrid";
import PropertiesPanel from "./components/PropertiesPanel";
import ContextMenu    from "./components/ContextMenu";
import {
  RenameModal, IndexModal, OpenWithModal,
  PasteModal, CompressModal,
} from "./components/Modals";

// Views
import DuplicatesView  from "./views/DuplicatesView";
import SmartDedupView  from "./views/SmartDedupView";
import HistoryView     from "./views/HistoryView";
import SnapshotsView   from "./views/SnapshotsView";
import TimelineView    from "./views/TimelineView";

// Types & helpers
import type {
  FileMeta, DeletedEntry, SnapshotInfo,
  FileProperties, FolderProperties,
  CtxItem, CtxMenu, PanelInfo, ViewMode, AppActions,
} from "./types";
import { getCat } from "./helpers";

import "./App.css";

export default function App() {
  // ── Core state ────────────────────────────────────────────────
  const [allFiles, setAllFiles]         = useState<[string, string][]>([]);
  const [currentPath, setCurrentPath]   = useState<string[]>([]);
  const [searchQuery, setSearchQuery]   = useState("");
  const [filterType, setFilterType]     = useState("all");
  const [viewMode, setViewMode]         = useState<ViewMode>("browser");
  const [status, setStatus]             = useState("Ready");
  const [deleted, setDeleted]           = useState<DeletedEntry[]>([]);
  const [snapshots, setSnapshots]       = useState<SnapshotInfo[]>([]);
  const [panelInfo, setPanelInfo]       = useState<PanelInfo | null>(null);
  const [ctxMenu, setCtxMenu]           = useState<CtxMenu | null>(null);
  const [clipboard, setClipboard]       = useState<CtxItem | null>(null);

  // ── Modal state ───────────────────────────────────────────────
  const [renameModal, setRenameModal]   = useState<{ hash: string|null; path: string; currentName: string; isFolder: boolean } | null>(null);
  const [indexModal, setIndexModal]     = useState<{ folderPath: string } | null>(null);
  const [openWithModal, setOpenWithModal] = useState<{ path: string } | null>(null);
  const [compressModal, setCompressModal] = useState<{ paths: string[] } | null>(null);
  const [pasteModal, setPasteModal]     = useState(false);

  const [snapshotNameInput, setSnapshotNameInput] = useState("");
  const [renameInput, setRenameInput]   = useState("");
  const [openWithInput, setOpenWithInput] = useState("");
  const [pasteDestInput, setPasteDestInput] = useState("");
  const [compressNameInput, setCompressNameInput] = useState("");

  // ── Data loading ──────────────────────────────────────────────

  const refreshVault = async () => {
    try { setAllFiles(await invoke("get_all_stored_files") as [string, string][]); }
    catch (e) { setStatus(`Error: ${e}`); }
  };

  const refreshHistory = async () => {
    try {
      setDeleted(await invoke("get_deleted_files") as DeletedEntry[]);
      setSnapshots(await invoke("get_snapshots") as SnapshotInfo[]);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  useEffect(() => { refreshVault(); refreshHistory(); }, []);
  useEffect(() => {
    const h = () => setCtxMenu(null);
    window.addEventListener("click", h);
    return () => window.removeEventListener("click", h);
  }, []);

  // ── Computed ──────────────────────────────────────────────────

  const parsedFiles = useMemo(() =>
    allFiles.map(([hash, json]) => {
      try { const m = JSON.parse(json); return { ...m, hash, name: m.path.split(/[\\/]/).pop() || m.path } as FileMeta; }
      catch { return null; }
    }).filter(f => f && (filterType === "all" || f.category === filterType)) as FileMeta[],
  [allFiles, filterType]);

  const allParsed = useMemo(() =>
    allFiles.map(([hash, json]) => {
      try { const m = JSON.parse(json); return { ...m, hash, name: m.path.split(/[\\/]/).pop() || m.path } as FileMeta; }
      catch { return null; }
    }).filter(Boolean) as FileMeta[],
  [allFiles]);

  const duplicateGroups = useMemo(() => {
    const g: Record<string, FileMeta[]> = {};
    parsedFiles.forEach(f => { if (!g[f.hash]) g[f.hash] = []; g[f.hash].push(f); });
    return Object.values(g).filter(a => a.length > 1);
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
            const folderPath = parts.slice(0, currentPath.length + 1).join("/");
            map.set(key, { name, isFolder, hash: isFolder ? null : f.hash, path: f.path, category: f.category, folderPath });
          }
        }
      }
    });
    return Array.from(map.values()).sort((a, b) => Number(b.isFolder) - Number(a.isFolder));
  }, [parsedFiles, currentPath, searchQuery]);

  // ── Actions ───────────────────────────────────────────────────

  const handleIndexFolder = async () => {
    const folder = await open({ directory: true });
    if (!folder) return;
    setIndexModal({ folderPath: folder as string });
    setSnapshotNameInput(new Date().toLocaleDateString("en-GB").replace(/\//g, "-"));
  };

  const handleAddFile = async () => {
    const file = await open({ multiple: false, directory: false });
    if (!file) return;
    try {
      const r = await invoke<string>("add_single_file", { path: file as string });
      await refreshVault(); setStatus(r);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const confirmIndex = async () => {
    if (!indexModal) return;
    const name = snapshotNameInput.trim() || new Date().toLocaleDateString("en-GB").replace(/\//g, "-");
    setIndexModal(null); setStatus("Indexing…");
    try {
      const r = await invoke<string>("start_auto_scan", { folderPath: indexModal.folderPath, snapshotName: name });
      await refreshVault(); await refreshHistory(); setStatus(r);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const handleOpen = async (path: string) => {
    const exists = await invoke<boolean>("check_file_status", { path });
    if (exists) await invoke("open_file", { path });
    else alert(`Ghost File: Not found on disk.\n\n${path}`);
  };

  const handleOpenWith = async () => {
    if (!openWithModal || !openWithInput.trim()) return;
    try { await invoke("open_file_with", { path: openWithModal.path, app: openWithInput.trim() }); setOpenWithModal(null); setOpenWithInput(""); }
    catch (e) { alert(`Failed: ${e}`); }
  };

  const handleDeleteToBin = async (hash: string, path: string) => {
    try {
      await invoke("delete_to_bin", { hash, path });
      await refreshVault(); await refreshHistory();
      if (panelInfo?.type === "file" && panelInfo.data.hash === hash) setPanelInfo(null);
      setStatus("Moved to Recycle Bin.");
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const handleDeleteFolderToBin = async (folderPath: string) => {
    try {
      const r = await invoke<string>("delete_folder_to_bin", { folderPath });
      await refreshVault(); await refreshHistory(); setPanelInfo(null); setStatus(r);
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const handlePermanentDelete = async (hash: string, path: string) => {
    if (!confirm(`Permanently delete? Cannot be undone.\n\n${path}`)) return;
    try {
      await invoke("delete_physical_file", { hash, path });
      await refreshVault(); await refreshHistory(); setPanelInfo(null); setStatus("Permanently deleted.");
    } catch (e) { setStatus(`Error: ${e}`); }
  };

  const handleRename = async () => {
    if (!renameModal || !renameInput.trim()) return;
    try {
      if (renameModal.isFolder) await invoke("rename_folder", { oldPath: renameModal.path, newName: renameInput.trim() });
      else await invoke("rename_in_index", { hash: renameModal.hash, newName: renameInput.trim() });
      await refreshVault(); setRenameModal(null); setRenameInput(""); setStatus("Renamed.");
    } catch (e) { alert(`Rename failed: ${e}`); }
  };

  const handleCut = (item: CtxItem) => {
    setClipboard(item);
    setStatus(`Cut: ${item.name}`);
  };

  const confirmPaste = async () => {
    if (!clipboard || !pasteDestInput.trim()) return;
    try {
      const r = clipboard.isFolder
        ? await invoke<string>("move_folder", { oldPath: clipboard.folderPath || clipboard.path, destinationParent: pasteDestInput.trim() })
        : await invoke<string>("move_file", { hash: clipboard.hash, destinationFolder: pasteDestInput.trim() });
      await refreshVault(); setClipboard(null); setPasteModal(false); setStatus(`Moved to: ${r}`);
    } catch (e) { alert(`Move failed: ${e}`); }
  };

  const showFileProps = async (hash: string) => {
    try { setPanelInfo({ type: "file", data: await invoke<FileProperties>("get_file_properties", { hash }) }); }
    catch (e) { setStatus(`Error: ${e}`); }
  };

  const showFolderProps = async (folderPath: string) => {
    try { setPanelInfo({ type: "folder", data: await invoke<FolderProperties>("get_folder_properties", { folderPath }) }); }
    catch (e) { setStatus(`Error: ${e}`); }
  };

  const handleCompress = (paths: string[]) => {
    setCompressNameInput(paths.length === 1 ? (paths[0].split(/[\\/]/).pop()?.replace(/\.[^.]+$/, "") || "archive") : "archive");
    setCompressModal({ paths });
  };

  const confirmCompress = async () => {
    if (!compressModal) return;
    const outputPath = await save({ defaultPath: compressNameInput + ".zip", filters: [{ name: "ZIP", extensions: ["zip"] }] });
    if (!outputPath) return;
    try { const r = await invoke<string>("compress_to_zip", { paths: compressModal.paths, outputPath }); setStatus(r); setCompressModal(null); }
    catch (e) { alert(`Compress failed: ${e}`); }
  };

  const handleExtract = async (zipPath: string) => {
    const outDir = await open({ directory: true });
    if (!outDir) return;
    try { const r = await invoke<string>("extract_zip", { zipPath, outputDir: outDir as string }); setStatus(r); await refreshVault(); }
    catch (e) { alert(`Extract failed: ${e}`); }
  };

  const handleCtx = (e: React.MouseEvent, item: CtxItem) => {
    e.preventDefault(); e.stopPropagation();
    setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 220), y: Math.min(e.clientY, window.innerHeight - 340), item });
  };

  const handleReset = async () => {
    if (!confirm("Reset entire vault index? History & snapshots are preserved.")) return;
    await invoke("clear_vault"); await refreshVault();
    setCurrentPath([]); setPanelInfo(null); setStatus("Vault reset.");
  };

  // ── AppActions bundle (passed to ContextMenu) ─────────────────

  const actions: AppActions = {
    handleOpen, handleDeleteToBin, handleDeleteFolderToBin,
    handlePermanentDelete, handleCut, handleCompress, handleExtract,
    showFileProps, showFolderProps,
    setRenameModal, setRenameInput,
    setOpenWithModal, setPasteModal,
  };

  // ── Render ────────────────────────────────────────────────────

  return (
    <div className="app-container" onClick={() => setCtxMenu(null)}>
      <div className="main-layout">

        <Sidebar
          viewMode={viewMode}         setViewMode={setViewMode}
          filterType={filterType}     setFilterType={setFilterType}
          setSearchQuery={setSearchQuery} setCurrentPath={setCurrentPath}
          totalFiles={parsedFiles.length}
          dupCount={duplicateGroups.length}
          smartDupCount={0}
          deletedCount={deleted.length}
          snapshotCount={snapshots.length}
          clipboard={clipboard}
          onPasteClick={() => setPasteModal(true)}
          onRefreshHistory={refreshHistory}
        />

        <section className="content-area">
          <Toolbar
            viewMode={viewMode}
            searchQuery={searchQuery}   setSearchQuery={setSearchQuery}
            currentPath={currentPath}   setCurrentPath={setCurrentPath}
            clipboard={clipboard}
            onIndexFolder={handleIndexFolder}
            onAddFile={handleAddFile}
            onPaste={() => setPasteModal(true)}
            onReset={handleReset}
          />

          <main className="file-grid">
            {viewMode === "browser" && (
              <FileGrid
                items={browserItems}
                parsedFiles={parsedFiles}
                currentPath={currentPath}
                onOpenFolder={name => setCurrentPath([...currentPath, name])}
                onFileClick={showFileProps}
                onFileDouble={handleOpen}
                onContextMenu={handleCtx}
                onIndexFolder={handleIndexFolder}
                onAddFile={handleAddFile}
              />
            )}
            {viewMode === "duplicates" && (
              <DuplicatesView
                groups={duplicateGroups}
                onOpen={handleOpen}
                onShowProps={showFileProps}
                onDeleteToBin={handleDeleteToBin}
              />
            )}
            {viewMode === "smartdup" && (
              <SmartDedupView
                allFiles={allParsed}
                onOpen={handleOpen}
                onDeleteToBin={handleDeleteToBin}
                onShowProps={showFileProps}
              />
            )}
            {viewMode === "history" && (
              <HistoryView deleted={deleted} onRefresh={refreshHistory} />
            )}
            {viewMode === "snapshots" && (
              <SnapshotsView snapshots={snapshots} onRefresh={refreshHistory} setStatus={setStatus} />
            )}
            {viewMode === "timeline" && (
              <TimelineView
                allFiles={allParsed}
                onOpen={handleOpen}
                onShowProps={showFileProps}
                onCtx={handleCtx}
              />
            )}
          </main>
        </section>

        {panelInfo && (
          <PropertiesPanel
            panelInfo={panelInfo}
            onClose={() => setPanelInfo(null)}
            onOpen={handleOpen}
            onOpenWith={path => setOpenWithModal({ path })}
            onRename={(hash, path, name, isFolder) => { setRenameInput(name); setRenameModal({ hash, path, currentName: name, isFolder }); }}
            onCut={handleCut}
            onCompress={handleCompress}
            onExtract={handleExtract}
            onDeleteToBin={handleDeleteToBin}
            onDeleteFolderToBin={handleDeleteFolderToBin}
            onPermanentDelete={handlePermanentDelete}
          />
        )}
      </div>

      <footer className="status-bar">
        <span className="st-msg">{status}</span>
        <span className="st-sep">·</span>
        <span>{parsedFiles.length} files</span>
        <span className="st-sep">·</span>
        <span>{duplicateGroups.length} dup groups</span>
        <span className="st-sep">·</span>
        <span>{deleted.length} deletion records</span>
        {clipboard && <><span className="st-sep">·</span><span style={{ color: "#fbbf24" }}>✂ {clipboard.name}</span></>}
      </footer>

      {ctxMenu && (
        <ContextMenu
          ctxMenu={ctxMenu}
          currentPath={currentPath}
          setCurrentPath={setCurrentPath}
          onClose={() => setCtxMenu(null)}
          actions={actions}
        />
      )}

      {renameModal && (
        <RenameModal
          isFolder={renameModal.isFolder} value={renameInput}
          onChange={setRenameInput} onConfirm={handleRename}
          onClose={() => setRenameModal(null)}
        />
      )}
      {indexModal && (
        <IndexModal
          folderPath={indexModal.folderPath} snapshotName={snapshotNameInput}
          onChange={setSnapshotNameInput} onConfirm={confirmIndex}
          onClose={() => setIndexModal(null)}
        />
      )}
      {openWithModal && (
        <OpenWithModal
          value={openWithInput} onChange={setOpenWithInput}
          onConfirm={handleOpenWith} onClose={() => setOpenWithModal(null)}
        />
      )}
      {pasteModal && clipboard && (
        <PasteModal
          clipboardName={clipboard.name} value={pasteDestInput}
          onChange={setPasteDestInput} onConfirm={confirmPaste}
          onClose={() => { setPasteModal(false); setClipboard(null); }}
        />
      )}
      {compressModal && (
        <CompressModal
          pathCount={compressModal.paths.length} archiveName={compressNameInput}
          onChange={setCompressNameInput} onConfirm={confirmCompress}
          onClose={() => setCompressModal(null)}
        />
      )}
    </div>
  );
}