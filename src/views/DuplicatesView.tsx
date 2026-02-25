import { Ic, catIcon } from "../Icons";
import { fmtSize } from "../helpers";
import type { FileMeta } from "../types";

interface Props {
  groups:         FileMeta[][];
  onOpen:         (path: string) => void;
  onShowProps:    (hash: string) => void;
  onDeleteToBin:  (hash: string, path: string) => void;
}

export default function DuplicatesView({ groups, onOpen, onShowProps, onDeleteToBin }: Props) {
  return (
    <div className="full-panel">
      <div className="panel-title">
        Duplicate Files — {groups.length} groups
        {groups.length > 0 && (
          <span className="panel-sub">
            {groups.reduce((n, g) => n + g.length - 1, 0)} redundant copies
          </span>
        )}
      </div>

      {groups.length === 0 && (
        <div className="empty-state">
          <div className="eico"><Ic.Check /></div>
          <p>No exact duplicates found</p>
          <small>Files with identical content will appear here</small>
        </div>
      )}

      {groups.map((group, i) => (
        <div key={i} className="dup-group">
          <div className="dup-hdr">
            <span className="dup-hash">{group[0].hash.substring(0, 24)}…</span>
            <span className="dup-info">{group.length} copies · {fmtSize(group[0].size)}</span>
          </div>
          {group.map((f, j) => (
            <div key={j} className="list-row">
              <span className="row-ico">{catIcon(f.category)}</span>
              <span className="row-path" onClick={() => onOpen(f.path)} title={f.path}>
                {f.path}
              </span>
              <div className="row-acts">
                <button className="btn-xs" onClick={() => onShowProps(f.hash)}>
                  <Ic.Info /> Info
                </button>
                <button className="btn-xs red" onClick={() => onDeleteToBin(f.hash, f.path)}>
                  <Ic.Trash /> Bin
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}