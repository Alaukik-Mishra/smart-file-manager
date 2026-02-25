import { invoke } from "@tauri-apps/api/core";
import { Ic } from "../Icons";
import { fmtTime } from "../helpers";
import type { SnapshotInfo } from "../types";

interface Props {
  snapshots:  SnapshotInfo[];
  onRefresh:  () => void;
  setStatus:  (s: string) => void;
}

export default function SnapshotsView({ snapshots, onRefresh, setStatus }: Props) {
  const handleDelete = async (snap: SnapshotInfo) => {
    if (!confirm(`Delete snapshot record "${snap.name}"?\nThis only removes the record, not your actual files.`)) return;
    await invoke("delete_snapshot", { snapshotName: snap.name, timestamp: snap.timestamp });
    await onRefresh();
    setStatus(`Snapshot "${snap.name}" deleted.`);
  };

  return (
    <div className="full-panel">
      <div className="panel-title">Snapshots — {snapshots.length} saved</div>
      <div className="snap-explain">
        A snapshot is <strong>automatically saved</strong> every time you click{" "}
        <strong>Index Folder</strong>. It records which files existed so deletions can be tracked.
      </div>

      {snapshots.length === 0 && (
        <div className="empty-state">
          <p>No snapshots — index a folder to create one</p>
        </div>
      )}

      {snapshots.map((snap, i) => (
        <div key={i} className="snap-card">
          <div className="snap-info">
            <div className="snap-name">{snap.name}</div>
            <div className="snap-meta">{snap.file_count} files · {fmtTime(snap.timestamp)}</div>
            <div className="snap-folder" title={snap.folder_path}>{snap.folder_path}</div>
          </div>
          <button className="btn-xs red" onClick={() => handleDelete(snap)}>
            <Ic.Trash /> Delete
          </button>
        </div>
      ))}
    </div>
  );
}