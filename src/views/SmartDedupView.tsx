import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Ic, catIcon } from "../Icons";
import { fmtSize } from "../helpers";
import type { FileMeta } from "../types";

interface SimilarGroup {
  best: FileMeta;
  others: FileMeta[];
  similarity_pct: number;
}

interface Props {
  allFiles:      FileMeta[];
  onOpen:        (path: string) => void;
  onDeleteToBin: (hash: string, path: string) => void;
  onShowProps:   (hash: string) => void;
}

export default function SmartDedupView({ allFiles, onOpen, onDeleteToBin, onShowProps }: Props) {
  const [groups, setGroups]     = useState<SimilarGroup[]>([]);
  const [scanning, setScanning] = useState(false);
  const [done, setDone]         = useState(false);
  const [threshold, setThreshold] = useState(90);

  const imageFiles = allFiles.filter(f => f.category === "image");

  const runScan = async () => {
    setScanning(true);
    setDone(false);
    try {
      const raw = await invoke<[string, string[], number][]>("find_similar_images", {
        threshold: 100 - threshold, // convert similarity% to max hamming distance
      });
      const parsed: SimilarGroup[] = raw.map(([bestHash, otherHashes, simPct]) => {
        const best = allFiles.find(f => f.hash === bestHash)!;
        const others = otherHashes.map(h => allFiles.find(f => f.hash === h)).filter(Boolean) as FileMeta[];
        return { best, others, similarity_pct: simPct };
      }).filter(g => g.best && g.others.length > 0);
      setGroups(parsed);
      setDone(true);
    } catch (e) {
      console.error(e);
    } finally {
      setScanning(false);
    }
  };

  return (
    <div className="full-panel">
      <div className="panel-title">
        <Ic.Brain /> Smart Deduplicator — Perceptual Image Matching
        {done && groups.length > 0 && (
          <span className="panel-sub">{groups.length} groups of similar images</span>
        )}
      </div>

      <div className="smartdup-intro">
        <p>
          Finds images that look <strong>nearly identical</strong> even if they are different files —
          different resolutions, slight crops, or re-saves. Uses perceptual hashing (DCT) in Rust.
        </p>
        <p style={{ marginTop: 6, color: "var(--t3)", fontSize: 11 }}>
          {imageFiles.length} images indexed · Only images are compared
        </p>
        <div className="threshold-row">
          <label>Similarity threshold: <strong>{threshold}%</strong></label>
          <input type="range" min={70} max={99} value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="threshold-slider" />
          <span className="threshold-hint">
            {threshold >= 95 ? "Very strict — nearly pixel-perfect" :
             threshold >= 85 ? "Balanced — catches most near-dupes" :
             "Loose — may include different images"}
          </span>
        </div>
        <button className="btn-primary" onClick={runScan} disabled={scanning || imageFiles.length === 0}>
          {scanning ? "Scanning…" : `Scan ${imageFiles.length} Images`}
        </button>
      </div>

      {scanning && (
        <div className="scan-progress">
          <div className="scan-bar"><div className="scan-fill" /></div>
          <span>Computing perceptual hashes…</span>
        </div>
      )}

      {done && groups.length === 0 && (
        <div className="empty-state">
          <div className="eico"><Ic.Check /></div>
          <p>No similar images found at {threshold}% threshold</p>
          <small>Try lowering the threshold to find more matches</small>
        </div>
      )}

      {groups.map((group, i) => (
        <div key={i} className="dup-group smartdup-group">
          <div className="dup-hdr">
            <span style={{ color: "var(--pu)", fontWeight: 700, fontSize: 11 }}>
              ~{group.similarity_pct}% similar
            </span>
            <span className="dup-info">
              1 best + {group.others.length} similar · {fmtSize(group.best.size)}
            </span>
          </div>

          {/* Best file */}
          <div className="list-row best-row">
            <span className="row-ico" style={{ color: "#4ade80" }}>{catIcon("image")}</span>
            <div className="row-info">
              <div className="row-name">
                <span className="best-badge">BEST</span> {group.best.name}
              </div>
              <div className="row-sub">{group.best.path}</div>
              <div className="row-sub">{fmtSize(group.best.size)}</div>
            </div>
            <div className="row-acts">
              <button className="btn-xs" onClick={() => onOpen(group.best.path)}>Open</button>
              <button className="btn-xs" onClick={() => onShowProps(group.best.hash)}>
                <Ic.Info />
              </button>
            </div>
          </div>

          {/* Similar files */}
          {group.others.map((f, j) => (
            <div key={j} className="list-row">
              <span className="row-ico" style={{ color: "#f87171" }}>{catIcon("image")}</span>
              <div className="row-info">
                <div className="row-name">{f.name}</div>
                <div className="row-sub">{f.path}</div>
                <div className="row-sub">{fmtSize(f.size)}</div>
              </div>
              <div className="row-acts">
                <button className="btn-xs" onClick={() => onOpen(f.path)}>Open</button>
                <button className="btn-xs" onClick={() => onShowProps(f.hash)}>
                  <Ic.Info />
                </button>
                <button className="btn-xs red" onClick={() => onDeleteToBin(f.hash, f.path)}>
                  <Ic.Trash /> Archive
                </button>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}