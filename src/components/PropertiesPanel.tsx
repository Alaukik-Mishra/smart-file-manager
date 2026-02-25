import { Ic, catIcon } from "../Icons";
import { fmtSize, catColor, getCat, parseModified } from "../helpers";
import type { PanelInfo, CtxItem } from "../types";

interface Props {
  panelInfo:            PanelInfo;
  onClose:              () => void;
  onOpen:               (path: string) => void;
  onOpenWith:           (path: string) => void;
  onRename:             (hash: string|null, path: string, name: string, isFolder: boolean) => void;
  onCut:                (item: CtxItem) => void;
  onCompress:           (paths: string[]) => void;
  onExtract:            (path: string) => void;
  onDeleteToBin:        (hash: string, path: string) => void;
  onDeleteFolderToBin:  (path: string) => void;
  onPermanentDelete:    (hash: string, path: string) => void;
}

export default function PropertiesPanel({
  panelInfo, onClose, onOpen, onOpenWith,
  onRename, onCut, onCompress, onExtract,
  onDeleteToBin, onDeleteFolderToBin, onPermanentDelete,
}: Props) {
  return (
    <aside className="props-panel">
      <div className="props-hdr">
        <span>PROPERTIES</span>
        <button className="icon-btn" onClick={onClose}><Ic.Close /></button>
      </div>

      {panelInfo.type === "file" && (() => {
        const p = panelInfo.data;
        const isArchive = p.category === "archive" || getCat(p.path) === "archive";
        return (
          <>
            <div className="props-ico" style={{ color: catColor[p.category] }}>
              {catIcon(p.category)}
            </div>
            <div className="props-name">{p.name}</div>
            <div className={`props-status ${p.exists_on_disk ? "on" : "off"}`}>
              {p.exists_on_disk ? "● On Disk" : "○ Not Found on Disk"}
            </div>

            <div className="props-rows">
              {([
                ["Size",     fmtSize(p.size)],
                ["Type",     p.category],
                ["Modified", parseModified(p.modified)],
                ["Hash",     p.hash.substring(0, 20) + "…"],
                ["Path",     p.path],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="prop-row">
                  <span>{k}</span>
                  <span
                    className={k === "Hash" ? "mono" : k === "Path" ? "path-val" : ""}
                    title={v}>{v}
                  </span>
                </div>
              ))}
            </div>

            <div className="props-btns">
              <button className="btn-primary w100" onClick={() => onOpen(p.path)}>Open</button>
              <button className="btn-outline w100" onClick={() => onOpenWith(p.path)}>
                <Ic.OpenWith /> Open With…
              </button>
              <button className="btn-outline w100"
                onClick={() => onRename(p.hash, p.path, p.name, false)}>
                <Ic.Rename /> Rename
              </button>
              <button className="btn-outline w100"
                onClick={() => onCut({ hash: p.hash, path: p.path, name: p.name, isFolder: false })}>
                <Ic.Cut /> Cut
              </button>
              <button className="btn-outline w100" onClick={() => onCompress([p.path])}>
                <Ic.Zip /> Compress to ZIP
              </button>
              {isArchive && (
                <button className="btn-outline w100" onClick={() => onExtract(p.path)}>
                  <Ic.Extract /> Extract
                </button>
              )}
              <div className="props-divider" />
              <button className="btn-outline red w100"
                onClick={() => onDeleteToBin(p.hash, p.path)}>
                <Ic.Trash /> Move to Recycle Bin
              </button>
              <button className="btn-ghost w100"
                onClick={() => onPermanentDelete(p.hash, p.path)}>
                Delete Permanently
              </button>
            </div>
          </>
        );
      })()}

      {panelInfo.type === "folder" && (() => {
        const p = panelInfo.data;
        return (
          <>
            <div className="props-ico" style={{ color: "#fbbf24" }}><Ic.Folder /></div>
            <div className="props-name">{p.name}</div>
            <div className={`props-status ${p.exists_on_disk ? "on" : "off"}`}>
              {p.exists_on_disk ? "● On Disk" : "○ Not Found"}
            </div>

            <div className="props-rows">
              {([
                ["Files inside", String(p.file_count)],
                ["Total Size",   fmtSize(p.total_size)],
                ["Path",         p.path],
              ] as [string, string][]).map(([k, v]) => (
                <div key={k} className="prop-row">
                  <span>{k}</span>
                  <span className={k === "Path" ? "path-val" : ""} title={v}>{v}</span>
                </div>
              ))}
            </div>

            <div className="props-btns">
              <button className="btn-outline w100"
                onClick={() => onRename(null, p.path, p.name, true)}>
                <Ic.Rename /> Rename Folder
              </button>
              <button className="btn-outline w100"
                onClick={() => onCut({ hash: null, path: p.path, name: p.name, isFolder: true, folderPath: p.path })}>
                <Ic.Cut /> Cut Folder
              </button>
              <button className="btn-outline w100" onClick={() => onCompress([p.path])}>
                <Ic.Zip /> Compress to ZIP
              </button>
              <div className="props-divider" />
              <button className="btn-outline red w100"
                onClick={() => onDeleteFolderToBin(p.path)}>
                <Ic.Trash /> Move to Recycle Bin
              </button>
            </div>
          </>
        );
      })()}
    </aside>
  );
}