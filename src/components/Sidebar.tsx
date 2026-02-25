import { Ic } from "../Icons";
import type { ViewMode, CtxItem } from "../types";

interface Props {
  viewMode:        ViewMode;
  setViewMode:     (v: ViewMode) => void;
  filterType:      string;
  setFilterType:   (v: string) => void;
  setSearchQuery:  (v: string) => void;
  setCurrentPath:  (v: string[]) => void;
  totalFiles:      number;
  dupCount:        number;
  smartDupCount:   number;
  deletedCount:    number;
  snapshotCount:   number;
  clipboard:       CtxItem | null;
  onPasteClick:    () => void;
  onRefreshHistory: () => void;
}

const LIBRARY = [
  { key: "all",      label: "Everything", sym: "◉" },
  { key: "image",    label: "Images",     sym: "◫" },
  { key: "video",    label: "Videos",     sym: "▷" },
  { key: "document", label: "Documents",  sym: "≡" },
  { key: "audio",    label: "Audio",      sym: "♪" },
  { key: "archive",  label: "Archives",   sym: "⊞" },
] as const;

export default function Sidebar({
  viewMode, setViewMode, filterType, setFilterType,
  setSearchQuery, setCurrentPath,
  totalFiles, dupCount, smartDupCount, deletedCount, snapshotCount,
  clipboard, onPasteClick, onRefreshHistory,
}: Props) {

  const goLibrary = (key: string) => {
    setFilterType(key);
    setViewMode("browser");
    setSearchQuery("");
    setCurrentPath([]);
  };

  return (
    <aside className="sidebar">
      <div className="app-logo">
        <span className="logo-mark">◈</span> VAULT
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">LIBRARY</div>
        {LIBRARY.map(({ key, label, sym }) => (
          <div key={key}
            className={`sidebar-item ${filterType === key && viewMode === "browser" ? "active" : ""}`}
            onClick={() => goLibrary(key)}>
            <span className="sico">{sym}</span>
            {label}
            {key === "all" && totalFiles > 0 && <span className="scnt">{totalFiles}</span>}
          </div>
        ))}
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">VIEWS</div>
        <div className={`sidebar-item ${viewMode === "timeline" ? "active" : ""}`}
          onClick={() => setViewMode("timeline")}>
          <span className="sico"><Ic.Timeline /></span>Timeline
        </div>
      </div>

      <div className="sidebar-section">
        <div className="sidebar-label">TOOLS</div>
        <div className={`sidebar-item ${viewMode === "duplicates" ? "active" : ""}`}
          onClick={() => setViewMode("duplicates")}>
          <span className="sico">⊗</span>Duplicates
          {dupCount > 0 && <span className="sbadge">{dupCount}</span>}
        </div>
        <div className={`sidebar-item ${viewMode === "smartdup" ? "active" : ""}`}
          onClick={() => setViewMode("smartdup")}>
          <span className="sico"><Ic.Brain /></span>Smart Dedup
          {smartDupCount > 0 && <span className="sbadge">{smartDupCount}</span>}
        </div>
        <div className={`sidebar-item ${viewMode === "history" ? "active" : ""}`}
          onClick={() => { setViewMode("history"); onRefreshHistory(); }}>
          <span className="sico">↺</span>Deleted Files
          {deletedCount > 0 && <span className="sbadge">{deletedCount}</span>}
        </div>
        <div className={`sidebar-item ${viewMode === "snapshots" ? "active" : ""}`}
          onClick={() => { setViewMode("snapshots"); onRefreshHistory(); }}>
          <span className="sico">◷</span>Snapshots
          {snapshotCount > 0 && <span className="scnt">{snapshotCount}</span>}
        </div>
      </div>

      {clipboard && (
        <div className="clipboard-bar" onClick={onPasteClick}>
          <Ic.Cut />
          <span>Clipboard: {clipboard.name}</span>
          <span className="clip-hint">click to paste</span>
        </div>
      )}
    </aside>
  );
}