import { useState, useMemo, useRef, useEffect } from "react";
import { Ic, catIcon } from "../Icons";
import { fmtSize, fmtTime, groupByDate, catColor } from "../helpers";
import type { FileMeta } from "../types";

interface Props {
  allFiles:    FileMeta[];
  onOpen:      (path: string) => void;
  onShowProps: (hash: string) => void;
  onCtx:       (e: React.MouseEvent, item: any) => void;
}

export default function TimelineView({ allFiles, onOpen, onShowProps, onCtx }: Props) {
  const [dateMode, setDateMode] = useState<"modified" | "indexed">("modified");
  const [filterCat, setFilterCat] = useState("all");
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const containerRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() =>
    filterCat === "all" ? allFiles : allFiles.filter(f => f.category === filterCat),
  [allFiles, filterCat]);

  const groups = useMemo(() => groupByDate(filtered, dateMode), [filtered, dateMode]);

  // Auto-expand the first 3 groups
  useEffect(() => {
    const first3 = new Set(groups.slice(0, 3).map(g => g.date));
    setExpandedDates(first3);
  }, [groups.length, dateMode]);

  const toggleDate = (date: string) => {
    setExpandedDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date);
      else next.add(date);
      return next;
    });
  };

  const totalFiles = groups.reduce((n, g) => n + g.files.length, 0);

  return (
    <div className="full-panel timeline-panel">
      {/* Controls */}
      <div className="timeline-controls">
        <div className="tl-toggle">
          <button
            className={`tl-btn ${dateMode === "modified" ? "active" : ""}`}
            onClick={() => setDateMode("modified")}>
            File Modified Date
          </button>
          <button
            className={`tl-btn ${dateMode === "indexed" ? "active" : ""}`}
            onClick={() => setDateMode("indexed")}>
            Date Indexed
          </button>
        </div>

        <div className="tl-cats">
          {["all","image","video","document","audio","archive"].map(cat => (
            <button key={cat}
              className={`tl-cat ${filterCat === cat ? "active" : ""}`}
              onClick={() => setFilterCat(cat)}>
              {cat === "all" ? "All" : cat.charAt(0).toUpperCase() + cat.slice(1)}
            </button>
          ))}
        </div>

        <div className="tl-summary">
          {totalFiles} files across {groups.length} dates
        </div>
      </div>

      {groups.length === 0 && (
        <div className="empty-state">
          <div className="eico"><Ic.Timeline /></div>
          <p>No files to show in timeline</p>
          <small>Index a folder to populate the timeline</small>
        </div>
      )}

      {/* Timeline */}
      <div className="timeline-scroll" ref={containerRef}>
        {groups.map(group => {
          const expanded = expandedDates.has(group.date);
          return (
            <div key={group.date} className="tl-group">
              {/* Date header */}
              <div className="tl-date-hdr" onClick={() => toggleDate(group.date)}>
                <div className="tl-dot" />
                <div className="tl-date-text">
                  <span className="tl-date-label">{group.displayDate}</span>
                  <span className="tl-date-count">{group.files.length} files</span>
                </div>
                <span className="tl-chevron">{expanded ? "▾" : "▸"}</span>
              </div>

              {/* Files grid */}
              {expanded && (
                <div className="tl-files">
                  {group.files.map(f => (
                    <div key={f.hash} className="tl-card"
                      style={{ "--cc": catColor[f.category] || "#94a3b8" } as React.CSSProperties}
                      onClick={() => onShowProps(f.hash)}
                      onDoubleClick={() => onOpen(f.path)}
                      onContextMenu={e => onCtx(e, { ...f, isFolder: false })}>
                      <div className={`tl-card-ico ${f.category || "other"}`}>
                        {catIcon(f.category)}
                      </div>
                      <div className="tl-card-name" title={f.name}>{f.name}</div>
                      <div className="tl-card-meta">{fmtSize(f.size)}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}