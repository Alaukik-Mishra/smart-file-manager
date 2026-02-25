import { invoke } from "@tauri-apps/api/core";
import { Ic, catIcon } from "../Icons";
import { fmtSize, fmtTime } from "../helpers";
import type { DeletedEntry } from "../types";

interface Props {
  deleted:        DeletedEntry[];
  onRefresh:      () => void;
}

export default function HistoryView({ deleted, onRefresh }: Props) {
  const handleClearAll = async () => {
    if (!confirm("Clear all deletion records? This does not restore the files.")) return;
    await invoke("clear_deleted_history");
    onRefresh();
  };

  return (
    <div className="full-panel">
      <div className="panel-title">
        Deleted Files — {deleted.length} records
        {deleted.length > 0 && (
          <button className="btn-xs" style={{ marginLeft: "auto" }} onClick={handleClearAll}>
            Clear All Records
          </button>
        )}
      </div>

      <div className="history-note">
        Files sent to the <strong>Windows Recycle Bin</strong> appear here.
        Restore them from the Recycle Bin on your desktop.
        Files marked <span className="perm-tag">Permanent</span> are gone forever.
      </div>

      {deleted.length === 0 && (
        <div className="empty-state">
          <div className="eico"><Ic.Trash /></div>
          <p>No deleted files recorded</p>
          <small>Files deleted through this app appear here</small>
        </div>
      )}

      {deleted.map((e, i) => (
        <div key={i} className="list-row del-row">
          <span className="row-ico" style={{ color: "#f87171" }}>
            {catIcon(e.category)}
          </span>
          <div className="row-info">
            <div className="row-name">{e.name}</div>
            <div className="row-sub" title={e.path}>{e.path}</div>
          </div>
          <div className="row-meta">
            <span>{fmtSize(e.size)}</span>
            <span>{fmtTime(e.deleted_at)}</span>
            {e.snapshot_name === "permanent"
              ? <span className="perm-tag">Permanent</span>
              : <span className="bin-tag">In Recycle Bin</span>
            }
          </div>
        </div>
      ))}
    </div>
  );
}