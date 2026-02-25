import { useRef } from "react";
import { Ic } from "../Icons";
import { getCat } from "../helpers";
import type { CtxMenu, CtxItem, AppActions } from "../types";

interface Props {
  ctxMenu:        CtxMenu;
  currentPath:    string[];
  setCurrentPath: (v: string[]) => void;
  onClose:        () => void;
  actions:        AppActions;
}

export default function ContextMenu({ ctxMenu, currentPath, setCurrentPath, onClose, actions }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const { item } = ctxMenu;

  const wrap = (fn: () => void) => () => { fn(); onClose(); };

  return (
    <div ref={ref} className="ctx-menu"
      style={{ left: ctxMenu.x, top: ctxMenu.y }}
      onClick={e => e.stopPropagation()}>
      {item.isFolder ? (
        <>
          <div className="ctx-row" onClick={wrap(() => setCurrentPath([...currentPath, item.name]))}>
            <Ic.Open /> Open
          </div>
          <div className="ctx-row" onClick={wrap(() => actions.showFolderProps(item.folderPath || item.path))}>
            <Ic.Info /> Properties
          </div>
          <div className="ctx-sep" />
          <div className="ctx-row" onClick={wrap(() =>
            actions.setRenameModal({ hash: null, path: item.folderPath || item.path, currentName: item.name, isFolder: true }))}>
            <Ic.Rename /> Rename
          </div>
          <div className="ctx-row" onClick={wrap(() => actions.handleCut(item))}>
            <Ic.Cut /> Cut
          </div>
          <div className="ctx-row" onClick={wrap(() => actions.handleCompress([item.folderPath || item.path]))}>
            <Ic.Zip /> Compress to ZIP
          </div>
          <div className="ctx-sep" />
          <div className="ctx-row red" onClick={wrap(() => actions.handleDeleteFolderToBin(item.folderPath || item.path))}>
            <Ic.Trash /> Move to Recycle Bin
          </div>
        </>
      ) : (
        <>
          <div className="ctx-row" onClick={wrap(() => actions.handleOpen(item.path))}>
            <Ic.Open /> Open
          </div>
          <div className="ctx-row" onClick={wrap(() => actions.setOpenWithModal({ path: item.path }))}>
            <Ic.OpenWith /> Open With…
          </div>
          <div className="ctx-sep" />
          <div className="ctx-row" onClick={wrap(() => item.hash && actions.showFileProps(item.hash))}>
            <Ic.Info /> Properties
          </div>
          <div className="ctx-row" onClick={wrap(() => {
            actions.setRenameInput(item.name);
            actions.setRenameModal({ hash: item.hash, path: item.path, currentName: item.name, isFolder: false });
          })}>
            <Ic.Rename /> Rename
          </div>
          <div className="ctx-row" onClick={wrap(() => actions.handleCut(item))}>
            <Ic.Cut /> Cut
          </div>
          <div className="ctx-row" onClick={wrap(() => actions.handleCompress([item.path]))}>
            <Ic.Zip /> Compress to ZIP
          </div>
          {getCat(item.path) === "archive" && (
            <div className="ctx-row" onClick={wrap(() => actions.handleExtract(item.path))}>
              <Ic.Extract /> Extract
            </div>
          )}
          <div className="ctx-sep" />
          <div className="ctx-row red" onClick={wrap(() => item.hash && actions.handleDeleteToBin(item.hash, item.path))}>
            <Ic.Trash /> Move to Recycle Bin
          </div>
          <div className="ctx-row red" onClick={wrap(() => item.hash && actions.handlePermanentDelete(item.hash, item.path))}>
            ✕ Delete Permanently
          </div>
        </>
      )}
    </div>
  );
}