const s = (w=20,h=20) => ({ width: w, height: h, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round" as const, strokeLinejoin: "round" as const });
const xs = (w=13) => ({ ...s(w,w), strokeWidth: 2 });

export const Ic = {
  Folder:   () => <svg {...s()}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>,
  Image:    () => <svg {...s()}><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>,
  Video:    () => <svg {...s()}><rect x="2" y="4" width="15" height="16" rx="2"/><polygon points="17 9 22 12 17 15 17 9"/></svg>,
  Document: () => <svg {...s()}><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="13" y2="17"/></svg>,
  Audio:    () => <svg {...s()}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>,
  Archive:  () => <svg {...s()}><rect x="2" y="3" width="20" height="4" rx="1"/><path d="M4 7v13a1 1 0 001 1h14a1 1 0 001-1V7"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  Exe:      () => <svg {...s()}><rect x="2" y="2" width="20" height="20" rx="2"/><polyline points="8 17 12 13 8 9"/><line x1="14" y1="17" x2="16" y2="17"/></svg>,
  File:     () => <svg {...s()}><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><polyline points="13 2 13 9 20 9"/></svg>,
  Trash:    () => <svg {...xs()}><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/></svg>,
  Cut:      () => <svg {...xs()}><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></svg>,
  Rename:   () => <svg {...xs()}><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  Zip:      () => <svg {...xs()}><rect x="2" y="3" width="20" height="4" rx="1"/><path d="M4 7v13a1 1 0 001 1h14a1 1 0 001-1V7"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>,
  Extract:  () => <svg {...xs()}><polyline points="8 17 12 21 16 17"/><line x1="12" y1="12" x2="12" y2="21"/><path d="M20.88 18.09A5 5 0 0018 9h-1.26A8 8 0 103 16.29"/></svg>,
  OpenWith: () => <svg {...xs()}><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>,
  Info:     () => <svg {...xs()}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>,
  Close:    () => <svg {...xs(13)} strokeWidth={2.5}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
  ChevR:    () => <svg {...xs(11)} strokeWidth={2.5}><polyline points="9 18 15 12 9 6"/></svg>,
  Search:   () => <svg {...xs()}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  Plus:     () => <svg {...xs()} strokeWidth={2.5}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>,
  Open:     () => <svg {...xs()}><path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V7z"/></svg>,
  Timeline: () => <svg {...xs()}><line x1="12" y1="2" x2="12" y2="22"/><polyline points="17 7 12 2 7 7"/><line x1="5" y1="10" x2="19" y2="10"/><line x1="5" y1="14" x2="19" y2="14"/><line x1="5" y1="18" x2="19" y2="18"/></svg>,
  Brain:    () => <svg {...xs()}><path d="M9.5 2a2.5 2.5 0 015 0v1a2.5 2.5 0 01-5 0V2z"/><path d="M2 9.5a2.5 2.5 0 010 5h1a2.5 2.5 0 010-5H2z"/><path d="M22 9.5a2.5 2.5 0 010 5h-1a2.5 2.5 0 010-5h1z"/><path d="M9 2.5C6 3 3 6 3 9.5c0 2.5 1.5 4.5 3 5.5V21h12v-6c1.5-1 3-3 3-5.5C21 6 18 3 15 2.5"/><line x1="9" y1="21" x2="9" y2="15"/><line x1="15" y1="21" x2="15" y2="15"/></svg>,
  Star:     () => <svg {...xs()}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
  Check:    () => <svg {...xs()}><polyline points="20 6 9 17 4 12"/></svg>,
  Archive2: () => <svg {...xs()}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>,
};

export const catIcon = (cat: string) => {
  switch (cat) {
    case "image":      return <Ic.Image />;
    case "video":      return <Ic.Video />;
    case "document":   return <Ic.Document />;
    case "audio":      return <Ic.Audio />;
    case "archive":    return <Ic.Archive />;
    case "executable": return <Ic.Exe />;
    default:           return <Ic.File />;
  }
};