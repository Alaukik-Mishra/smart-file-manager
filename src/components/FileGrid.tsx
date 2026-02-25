import { Ic, catIcon } from "../Icons";
import { fmtSize, catColor } from "../helpers";
import type { FileMeta, CtxItem } from "../types";

interface BrowserItem {
  name:       string;
  isFolder:   boolean;
  hash:       string | null;
  path:       string;
  category:   string;
  folderPath: string;
}

interface Props {
  items:          BrowserItem[];
  parsedFiles:    FileMeta[];
  currentPath:    string[];
  onOpenFolder:   (name: string) => void;
  onFileClick:    (hash: string) => void;
  onFileDouble:   (path: string) => void;
  onContextMenu:  (e: React.MouseEvent, item: CtxItem) => void;
  onIndexFolder:  () => void;
  onAddFile:      () => void;
}

export default function FileGrid({
  items, parsedFiles, currentPath,
  onOpenFolder, onFileClick, onFileDouble,
  onContextMenu, onIndexFolder, onAddFile,
}: Props) {
  if (items.length === 0) {
    return (
      <div className="empty-state">
        <div className="eico"><Ic.Folder /></div>
        <p>Nothing indexed yet</p>
        <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
          <button className="btn-primary" onClick={onIndexFolder}>
            <Ic.Plus /> Index Folder
          </button>
          <button className="btn-secondary" onClick={onAddFile}>
            <Ic.Plus /> Add File
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      {items.map(item => (
        <div
          key={item.isFolder ? `dir-${item.name}` : item.hash}
          className="grid-card"
          style={!item.isFolder ? { "--cc": catColor[item.category] || "#94a3b8" } as React.CSSProperties : {}}
          onClick={() => !item.isFolder && item.hash && onFileClick(item.hash)}
          onDoubleClick={() =>
            item.isFolder ? onOpenFolder(item.name) : onFileDouble(item.path)
          }
          onContextMenu={e => onContextMenu(e, item)}
        >
          <div className={`card-ico ${item.isFolder ? "folder" : (item.category || "other")}`}>
            {item.isFolder ? <Ic.Folder /> : catIcon(item.category)}
          </div>
          <div className="item-name" title={item.name}>{item.name}</div>
          {!item.isFolder && (
            <div className="card-size">
              {fmtSize(parsedFiles.find(f => f.hash === item.hash)?.size || 0)}
            </div>
          )}
        </div>
      ))}
    </>
  );
}