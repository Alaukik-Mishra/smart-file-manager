export const fmtSize = (b: number): string => {
  if (b < 1024) return b + " B";
  if (b < 1048576) return (b / 1024).toFixed(1) + " KB";
  if (b < 1073741824) return (b / 1048576).toFixed(2) + " MB";
  return (b / 1073741824).toFixed(2) + " GB";
};

export const fmtTime = (ts: number): string =>
  new Date(ts * 1000).toLocaleString();

export const fmtDate = (ts: number): string =>
  new Date(ts * 1000).toLocaleDateString("en-GB", {
    day: "numeric", month: "long", year: "numeric",
  });

export const getCat = (path: string): string => {
  const ext = path.split(".").pop()?.toLowerCase() || "";
  if (["jpg","jpeg","png","gif","webp","bmp","svg","ico"].includes(ext)) return "image";
  if (["mp4","mkv","mov","avi","wmv","webm","flv"].includes(ext)) return "video";
  if (["pdf","doc","docx","txt","xlsx","csv","pptx","md"].includes(ext)) return "document";
  if (["mp3","wav","flac","aac","ogg","m4a"].includes(ext)) return "audio";
  if (["zip","rar","7z","tar","gz","bz2"].includes(ext)) return "archive";
  if (["exe","msi","dmg","deb"].includes(ext)) return "executable";
  return "other";
};

export const catColor: Record<string, string> = {
  image:      "#38bdf8",
  video:      "#a78bfa",
  document:   "#6ee7b7",
  audio:      "#fb923c",
  archive:    "#fbbf24",
  executable: "#f87171",
  other:      "#94a3b8",
};

export const parseModified = (raw: string): string =>
  raw.replace(/Some\(|\)/g, "").replace("SystemTime {", "").trim();

// Group files by a date string key
export const groupByDate = (
  files: { modified?: string; path: string; size: number; hash: string; name: string; category: string }[],
  mode: "modified" | "indexed"
): { date: string; displayDate: string; files: typeof files }[] => {
  const map = new Map<string, typeof files>();

  files.forEach(f => {
    let dateKey = "Unknown Date";
    if (mode === "modified" && f.modified) {
      // Extract date portion from the modified string
      const m = f.modified.match(/(\d{4}-\d{2}-\d{2})/);
      dateKey = m ? m[1] : "Unknown Date";
    }
    if (!map.has(dateKey)) map.set(dateKey, []);
    map.get(dateKey)!.push(f);
  });

  return Array.from(map.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, files]) => ({
      date,
      displayDate: date === "Unknown Date" ? "Unknown Date"
        : new Date(date + "T00:00:00").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" }),
      files,
    }));
};