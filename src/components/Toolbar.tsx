import { Ic } from "../Icons";
import type { ViewMode, CtxItem } from "../types";

interface Props {
  viewMode:       ViewMode;
  searchQuery:    string;
  setSearchQuery: (v: string) => void;
  currentPath:    string[];
  setCurrentPath: (v: string[]) => void;
  clipboard:      CtxItem | null;
  onIndexFolder:  () => void;
  onAddFile:      () => void;
  onPaste:        () => void;
  onReset:        () => void;
}

export default function Toolbar({
  viewMode, searchQuery, setSearchQuery,
  currentPath, setCurrentPath,
  clipboard, onIndexFolder, onAddFile, onPaste, onReset,
}: Props) {
  return (
    <header className="top-bar">
      <div className="toolbar">
        <button className="btn-primary" onClick={onIndexFolder}>
          <Ic.Plus /> Index Folder
        </button>
        <button className="btn-secondary" onClick={onAddFile}>
          <Ic.Plus /> Add File
        </button>
        {clipboard && (
          <button
            className="btn-secondary"
            style={{ color: "#fbbf24", borderColor: "rgba(251,191,36,.4)" }}
            onClick={onPaste}>
            Paste
          </button>
        )}
        <div className="search-wrap">
          <span className="sico-search"><Ic.Search /></span>
          <input
            className="search-input"
            placeholder="Search files and folders..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <button className="btn-ghost" onClick={onReset}>Reset</button>
      </div>

      {viewMode === "browser" && !searchQuery && (
        <nav className="breadcrumb">
          <span className="crumb-home" onClick={() => setCurrentPath([])}>Vault</span>
          {currentPath.map((p, i) => (
            <span key={i} className="crumb-seg">
              <Ic.ChevR />
              <span onClick={() => setCurrentPath(currentPath.slice(0, i + 1))}>{p}</span>
            </span>
          ))}
        </nav>
      )}
    </header>
  );
}