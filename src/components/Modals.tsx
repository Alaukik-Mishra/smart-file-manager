import { Ic } from "../Icons";

// ── Base Modal ─────────────────────────────────────────────────

export function Modal({ title, onClose, children, width = 440 }: {
  title: string; onClose: () => void;
  children: React.ReactNode; width?: number;
}) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ width }} onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <span>{title}</span>
          <button className="icon-btn" onClick={onClose}><Ic.Close /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}

// ── Rename Modal ───────────────────────────────────────────────

export function RenameModal({ isFolder, value, onChange, onConfirm, onClose }: {
  isFolder: boolean; value: string;
  onChange: (v: string) => void;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title={isFolder ? "Rename Folder" : "Rename File"} onClose={onClose}>
      <div className="modal-field">
        <label>New name</label>
        <input className="modal-input" value={value}
          onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onConfirm()} autoFocus />
      </div>
      <div className="modal-footer">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>Rename</button>
      </div>
    </Modal>
  );
}

// ── Index Folder Modal ─────────────────────────────────────────

export function IndexModal({ folderPath, snapshotName, onChange, onConfirm, onClose }: {
  folderPath: string; snapshotName: string;
  onChange: (v: string) => void;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title="Index Folder" onClose={onClose}>
      <p className="modal-path">{folderPath}</p>
      <div className="modal-field">
        <label>Snapshot name</label>
        <input className="modal-input"
          placeholder="e.g. before-cleanup, project-v2..."
          value={snapshotName} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onConfirm()} autoFocus />
        <small className="modal-hint">
          A snapshot is auto-saved with this name to track future deletions.
        </small>
      </div>
      <div className="modal-footer">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>Start Indexing</button>
      </div>
    </Modal>
  );
}

// ── Open With Modal ────────────────────────────────────────────

export function OpenWithModal({ value, onChange, onConfirm, onClose }: {
  value: string; onChange: (v: string) => void;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title="Open With" onClose={onClose}>
      <p className="modal-hint" style={{ marginBottom: 12 }}>
        Type the application name or full path.
      </p>
      <div className="modal-field">
        <label>Application</label>
        <input className="modal-input"
          placeholder="e.g.  notepad   vlc   code   winrar"
          value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onConfirm()} autoFocus />
      </div>
      <div className="modal-footer">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>Open</button>
      </div>
    </Modal>
  );
}

// ── Paste Modal ────────────────────────────────────────────────

export function PasteModal({ clipboardName, value, onChange, onConfirm, onClose }: {
  clipboardName: string; value: string;
  onChange: (v: string) => void;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title="Paste — Choose Destination" onClose={onClose}>
      <p className="modal-hint" style={{ marginBottom: 12 }}>
        Moving: <strong style={{ color: "#e2e6f3" }}>{clipboardName}</strong>
      </p>
      <div className="modal-field">
        <label>Destination folder path</label>
        <input className="modal-input"
          placeholder="e.g. C:\Users\admin\Documents"
          value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onConfirm()} autoFocus />
      </div>
      <div className="modal-footer">
        <button className="btn-ghost" onClick={() => { onClose(); }}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>Move Here</button>
      </div>
    </Modal>
  );
}

// ── Compress Modal ─────────────────────────────────────────────

export function CompressModal({ pathCount, archiveName, onChange, onConfirm, onClose }: {
  pathCount: number; archiveName: string;
  onChange: (v: string) => void;
  onConfirm: () => void; onClose: () => void;
}) {
  return (
    <Modal title="Compress to ZIP" onClose={onClose}>
      <p className="modal-hint" style={{ marginBottom: 12 }}>
        {pathCount} item(s) will be compressed.
      </p>
      <div className="modal-field">
        <label>Archive name</label>
        <input className="modal-input" placeholder="archive"
          value={archiveName} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onConfirm()} autoFocus />
        <small className="modal-hint">.zip will be added automatically</small>
      </div>
      <div className="modal-footer">
        <button className="btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn-primary" onClick={onConfirm}>Choose Save Location →</button>
      </div>
    </Modal>
  );
}