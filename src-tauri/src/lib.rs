use blake3::Hasher;
use sled::Db;
use std::fs::{self, File};
use std::io::{Read, Write};
use std::sync::Mutex;
use std::path::Path;
use tauri::{Manager, State};
use walkdir::WalkDir;
use serde::{Serialize, Deserialize};
use std::time::{SystemTime, UNIX_EPOCH};

// ── STRUCTS ────────────────────────────────────────────────────

#[derive(Serialize, Deserialize, Clone)]
pub struct FileMeta {
    pub path: String,
    pub size: u64,
    pub modified: String,
    pub category: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct DeletedEntry {
    pub hash: String,
    pub path: String,
    pub name: String,
    pub size: u64,
    pub category: String,
    pub deleted_at: u64,
    pub snapshot_name: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct SnapshotInfo {
    pub name: String,
    pub timestamp: u64,
    pub file_count: usize,
    pub folder_path: String,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FileProperties {
    pub path: String,
    pub name: String,
    pub size: u64,
    pub hash: String,
    pub modified: String,
    pub category: String,
    pub exists_on_disk: bool,
}

#[derive(Serialize, Deserialize, Clone)]
pub struct FolderProperties {
    pub path: String,
    pub name: String,
    pub file_count: usize,
    pub total_size: u64,
    pub exists_on_disk: bool,
}

pub struct AppState {
    pub db: Mutex<Db>,
    pub version_db: Mutex<Db>,
}

// ── HELPERS ────────────────────────────────────────────────────

fn now_ts() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn get_category(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg"|"jpeg"|"png"|"gif"|"webp"|"bmp"|"svg"|"ico" => "image",
        "mp4"|"mkv"|"mov"|"avi"|"wmv"|"webm"|"flv"        => "video",
        "pdf"|"doc"|"docx"|"txt"|"xlsx"|"xls"|"pptx"|"csv"|"md" => "document",
        "mp3"|"wav"|"flac"|"aac"|"ogg"|"m4a"              => "audio",
        "zip"|"rar"|"7z"|"tar"|"gz"|"bz2"                 => "archive",
        "exe"|"msi"|"dmg"|"deb"                           => "executable",
        _                                                   => "other",
    }.to_string()
}

fn calculate_hash(path: &str) -> Result<String, String> {
    let mut file = File::open(path).map_err(|e| e.to_string())?;
    let mut hasher = Hasher::new();
    let mut buffer = [0u8; 65536];
    loop {
        let n = file.read(&mut buffer).map_err(|e| e.to_string())?;
        if n == 0 { break; }
        hasher.update(&buffer[..n]);
    }
    Ok(hasher.finalize().to_string())
}

fn index_single_path(path: &str, db: &Db) -> Result<String, String> {
    let p = Path::new(path);
    if !p.exists() { return Err(format!("Path does not exist: {}", path)); }
    let metadata = fs::metadata(p).map_err(|e| e.to_string())?;
    let size = metadata.len();
    let modified = format!("{:?}", metadata.modified().unwrap_or(SystemTime::now()));
    let category = get_category(path);
    let hash = calculate_hash(path)?;
    let meta = FileMeta { path: path.to_string(), size, modified, category };
    let encoded = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    db.insert(hash.as_bytes(), encoded.as_bytes()).map_err(|e| e.to_string())?;
    Ok(hash)
}

// ── PERCEPTUAL HASHING ─────────────────────────────────────────
// DCT-based perceptual hash (pHash) — pure Rust, no C deps
// Returns a 64-bit hash as u64

fn perceptual_hash(path: &str) -> Result<u64, String> {
    use image::imageops::FilterType;
    use image::GenericImageView;

    let img = image::open(path).map_err(|e| e.to_string())?;

    // Step 1: Resize to 32x32 grayscale for DCT
    let small = img.resize_exact(32, 32, FilterType::Lanczos3)
        .grayscale();

    // Step 2: Build pixel matrix as f64
    let mut pixels = [[0f64; 32]; 32];
    for y in 0..32 {
        for x in 0..32 {
            let p = small.get_pixel(x as u32, y as u32);
            pixels[y][x] = p[0] as f64;
        }
    }

    // Step 3: Apply 2D DCT (take top-left 8x8 coefficients)
    let mut dct = [[0f64; 8]; 8];
    for u in 0..8usize {
        for v in 0..8usize {
            let mut sum = 0f64;
            for x in 0..32usize {
                for y in 0..32usize {
                    let cos_u = ((2.0 * x as f64 + 1.0) * u as f64 * std::f64::consts::PI / 64.0).cos();
                    let cos_v = ((2.0 * y as f64 + 1.0) * v as f64 * std::f64::consts::PI / 64.0).cos();
                    sum += pixels[y][x] * cos_u * cos_v;
                }
            }
            let cu = if u == 0 { 1.0 / 2f64.sqrt() } else { 1.0 };
            let cv = if v == 0 { 1.0 / 2f64.sqrt() } else { 1.0 };
            dct[u][v] = (2.0 / 32.0) * cu * cv * sum;
        }
    }

    // Step 4: Compute mean of DCT values (skip [0][0] DC component)
    let mut values = Vec::with_capacity(63);
    for u in 0..8 {
        for v in 0..8 {
            if u == 0 && v == 0 { continue; }
            values.push(dct[u][v]);
        }
    }
    let mean = values.iter().sum::<f64>() / values.len() as f64;

    // Step 5: Build 64-bit hash — bit=1 if value > mean
    let mut hash: u64 = 0;
    for (i, &val) in values.iter().enumerate() {
        if val > mean {
            hash |= 1u64 << i;
        }
    }
    Ok(hash)
}

fn hamming_distance(a: u64, b: u64) -> u32 {
    (a ^ b).count_ones()
}

// ── FILE COMMANDS ──────────────────────────────────────────────

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn open_file_with(path: String, app: String) -> Result<(), String> {
    std::process::Command::new(&app).arg(&path).spawn().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn check_file_status(path: String) -> bool {
    Path::new(&path).exists()
}

#[tauri::command]
fn get_file_properties(hash: String, state: State<'_, AppState>) -> Result<FileProperties, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let v = db.get(hash.as_bytes()).map_err(|e| e.to_string())?.ok_or("Hash not found")?;
    let meta: FileMeta = serde_json::from_slice(&v).map_err(|e| e.to_string())?;
    let name = meta.path.split(|c| c == '/' || c == '\\').last().unwrap_or("").to_string();
    let exists = Path::new(&meta.path).exists();
    Ok(FileProperties { path: meta.path, name, size: meta.size, hash, modified: meta.modified, category: meta.category, exists_on_disk: exists })
}

#[tauri::command]
fn get_folder_properties(folder_path: String, state: State<'_, AppState>) -> Result<FolderProperties, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let norm = folder_path.replace('\\', "/").to_lowercase();
    let name = folder_path.split(|c| c == '/' || c == '\\').last().unwrap_or("").to_string();
    let exists = Path::new(&folder_path).exists();
    let mut file_count = 0usize;
    let mut total_size = 0u64;
    for item in db.iter() {
        if let Ok((_, v)) = item {
            if let Ok(meta) = serde_json::from_slice::<FileMeta>(&v) {
                if meta.path.replace('\\', "/").to_lowercase().starts_with(&norm) {
                    file_count += 1;
                    total_size += meta.size;
                }
            }
        }
    }
    Ok(FolderProperties { path: folder_path, name, file_count, total_size, exists_on_disk: exists })
}

#[tauri::command]
fn add_single_file(path: String, state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let hash = index_single_path(&path, &db)?;
    db.flush().map_err(|e| e.to_string())?;
    let name = path.split(|c| c == '/' || c == '\\').last().unwrap_or("");
    Ok(format!("Added: {} ({})", name, &hash[..12]))
}

// ── RENAME ─────────────────────────────────────────────────────

#[tauri::command]
fn rename_in_index(hash: String, new_name: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let v = db.get(hash.as_bytes()).map_err(|e| e.to_string())?.ok_or("Hash not found")?;
    let mut meta: FileMeta = serde_json::from_slice(&v).map_err(|e| e.to_string())?;
    let old_path = Path::new(&meta.path);
    let new_path = old_path.parent().ok_or("No parent")?.join(&new_name);
    if old_path.exists() { fs::rename(old_path, &new_path).map_err(|e| e.to_string())?; }
    meta.path = new_path.to_string_lossy().to_string();
    let encoded = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    db.insert(hash.as_bytes(), encoded.as_bytes()).map_err(|e| e.to_string())?;
    db.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn rename_folder(old_path: String, new_name: String, state: State<'_, AppState>) -> Result<String, String> {
    let old = Path::new(&old_path);
    let new_path = old.parent().ok_or("No parent")?.join(&new_name);
    if old.exists() { fs::rename(old, &new_path).map_err(|e| e.to_string())?; }
    let new_str = new_path.to_string_lossy().to_string();
    let old_norm = old_path.replace('\\', "/").to_lowercase();
    let new_norm = new_str.replace('\\', "/");
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let to_update: Vec<(String, FileMeta)> = db.iter()
        .filter_map(|i| i.ok())
        .filter_map(|(k, v)| { let h = String::from_utf8_lossy(&k).to_string(); serde_json::from_slice::<FileMeta>(&v).ok().map(|m| (h, m)) })
        .filter(|(_, m)| m.path.replace('\\', "/").to_lowercase().starts_with(&old_norm))
        .collect();
    for (hash, mut meta) in to_update {
        let rel = meta.path.replace('\\', "/")[old_norm.len()..].to_string();
        meta.path = format!("{}{}", new_norm, rel);
        db.insert(hash.as_bytes(), serde_json::to_string(&meta).unwrap().as_bytes()).unwrap();
    }
    db.flush().map_err(|e| e.to_string())?;
    Ok(new_str)
}

// ── DELETE ─────────────────────────────────────────────────────

#[tauri::command]
fn delete_to_bin(hash: String, path: String, state: State<'_, AppState>) -> Result<(), String> {
    let name = path.split(|c| c == '/' || c == '\\').last().unwrap_or("unknown").to_string();
    let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let category = get_category(&path);
    let entry = DeletedEntry { hash: hash.clone(), path: path.clone(), name, size, category, deleted_at: now_ts(), snapshot_name: "manual".to_string() };
    let del_key = format!("deleted::{}::{}", now_ts(), hash);
    { let vdb = state.version_db.lock().map_err(|e| e.to_string())?; vdb.insert(del_key.as_bytes(), serde_json::to_string(&entry).unwrap().as_bytes()).unwrap(); }
    if Path::new(&path).exists() { trash::delete(&path).map_err(|e| e.to_string())?; }
    state.db.lock().map_err(|e| e.to_string())?.remove(hash.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_folder_to_bin(folder_path: String, state: State<'_, AppState>) -> Result<String, String> {
    let norm = folder_path.replace('\\', "/").to_lowercase();
    let hashes: Vec<String> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.iter().filter_map(|i| i.ok()).filter_map(|(k, v)| {
            let hash = String::from_utf8_lossy(&k).to_string();
            serde_json::from_slice::<FileMeta>(&v).ok()
                .filter(|m| m.path.replace('\\', "/").to_lowercase().starts_with(&norm))
                .map(|_| hash)
        }).collect()
    };
    let count = hashes.len();
    if Path::new(&folder_path).exists() { trash::delete(&folder_path).map_err(|e| e.to_string())?; }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    for hash in hashes { db.remove(hash.as_bytes()).unwrap(); }
    db.flush().map_err(|e| e.to_string())?;
    Ok(format!("Moved {} files to Recycle Bin.", count))
}

#[tauri::command]
fn delete_physical_file(hash: String, path: String, state: State<'_, AppState>) -> Result<(), String> {
    let name = path.split(|c| c == '/' || c == '\\').last().unwrap_or("unknown").to_string();
    let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let entry = DeletedEntry { hash: hash.clone(), path: path.clone(), name, size, category: get_category(&path), deleted_at: now_ts(), snapshot_name: "permanent".to_string() };
    { let vdb = state.version_db.lock().map_err(|e| e.to_string())?; vdb.insert(format!("deleted::{}::{}", now_ts(), hash).as_bytes(), serde_json::to_string(&entry).unwrap().as_bytes()).unwrap(); }
    if Path::new(&path).exists() { fs::remove_file(&path).map_err(|e| e.to_string())?; }
    state.db.lock().map_err(|e| e.to_string())?.remove(hash.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
}

// ── MOVE / PASTE ────────────────────────────────────────────────

#[tauri::command]
fn move_file(hash: String, destination_folder: String, state: State<'_, AppState>) -> Result<String, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let v = db.get(hash.as_bytes()).map_err(|e| e.to_string())?.ok_or("Hash not found")?;
    let mut meta: FileMeta = serde_json::from_slice(&v).map_err(|e| e.to_string())?;
    let file_name = Path::new(&meta.path).file_name().ok_or("No filename")?.to_string_lossy().to_string();
    let new_path = Path::new(&destination_folder).join(&file_name);
    if Path::new(&meta.path).exists() { fs::rename(&meta.path, &new_path).map_err(|e| e.to_string())?; }
    meta.path = new_path.to_string_lossy().to_string();
    db.insert(hash.as_bytes(), serde_json::to_string(&meta).unwrap().as_bytes()).map_err(|e| e.to_string())?;
    db.flush().map_err(|e| e.to_string())?;
    Ok(meta.path)
}

#[tauri::command]
fn move_folder(old_path: String, destination_parent: String, state: State<'_, AppState>) -> Result<String, String> {
    let folder_name = Path::new(&old_path).file_name().ok_or("No folder name")?.to_string_lossy().to_string();
    let new_path = Path::new(&destination_parent).join(&folder_name);
    if Path::new(&old_path).exists() { fs::rename(&old_path, &new_path).map_err(|e| e.to_string())?; }
    let new_str = new_path.to_string_lossy().to_string();
    let old_norm = old_path.replace('\\', "/").to_lowercase();
    let new_norm = new_str.replace('\\', "/");
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let to_update: Vec<(String, FileMeta)> = db.iter()
        .filter_map(|i| i.ok())
        .filter_map(|(k, v)| { let h = String::from_utf8_lossy(&k).to_string(); serde_json::from_slice::<FileMeta>(&v).ok().map(|m| (h, m)) })
        .filter(|(_, m)| m.path.replace('\\', "/").to_lowercase().starts_with(&old_norm))
        .collect();
    for (hash, mut meta) in to_update {
        let rel = meta.path.replace('\\', "/")[old_norm.len()..].to_string();
        meta.path = format!("{}{}", new_norm, rel);
        db.insert(hash.as_bytes(), serde_json::to_string(&meta).unwrap().as_bytes()).unwrap();
    }
    db.flush().map_err(|e| e.to_string())?;
    Ok(new_str)
}

// ── COMPRESS / EXTRACT ─────────────────────────────────────────

#[tauri::command]
fn compress_to_zip(paths: Vec<String>, output_path: String) -> Result<String, String> {
    let file = File::create(&output_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options = zip::write::SimpleFileOptions::default().compression_method(zip::CompressionMethod::Deflated);
    for path_str in &paths {
        let path = Path::new(path_str);
        if path.is_file() {
            let name = path.file_name().unwrap_or_default().to_string_lossy();
            zip.start_file(name.as_ref(), options).map_err(|e| e.to_string())?;
            let mut buf = Vec::new();
            File::open(path).map_err(|e| e.to_string())?.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            zip.write_all(&buf).map_err(|e| e.to_string())?;
        } else if path.is_dir() {
            for entry in WalkDir::new(path).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    let rel = entry.path().strip_prefix(path.parent().unwrap_or(path)).unwrap_or(entry.path()).to_string_lossy();
                    zip.start_file(rel.as_ref(), options).map_err(|e| e.to_string())?;
                    let mut buf = Vec::new();
                    File::open(entry.path()).map_err(|e| e.to_string())?.read_to_end(&mut buf).map_err(|e| e.to_string())?;
                    zip.write_all(&buf).map_err(|e| e.to_string())?;
                }
            }
        }
    }
    zip.finish().map_err(|e| e.to_string())?;
    Ok(format!("Compressed to: {}", output_path))
}

#[tauri::command]
fn extract_zip(zip_path: String, output_dir: String) -> Result<String, String> {
    let file = File::open(&zip_path).map_err(|e| e.to_string())?;
    let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;
    let total = archive.len();
    fs::create_dir_all(&output_dir).map_err(|e| e.to_string())?;
    for i in 0..total {
        let mut entry = archive.by_index(i).map_err(|e| e.to_string())?;
        let out = Path::new(&output_dir).join(entry.name());
        if entry.name().ends_with('/') { fs::create_dir_all(&out).map_err(|e| e.to_string())?; }
        else {
            if let Some(p) = out.parent() { fs::create_dir_all(p).map_err(|e| e.to_string())?; }
            let mut buf = Vec::new();
            entry.read_to_end(&mut buf).map_err(|e| e.to_string())?;
            File::create(&out).map_err(|e| e.to_string())?.write_all(&buf).map_err(|e| e.to_string())?;
        }
    }
    Ok(format!("Extracted {} files to: {}", total, output_dir))
}

// ── SMART DEDUP — PERCEPTUAL HASHING ──────────────────────────
// Returns: Vec of (best_hash, [similar_hashes], similarity_pct)

#[tauri::command]
async fn find_similar_images(
    threshold: u32,           // max hamming distance (0=identical, 64=totally different)
    state: State<'_, AppState>,
) -> Result<Vec<(String, Vec<String>, u32)>, String> {
    // Collect all image files from vault
    let images: Vec<(String, String)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        db.iter()
            .filter_map(|i| i.ok())
            .filter_map(|(k, v)| {
                let hash = String::from_utf8_lossy(&k).to_string();
                serde_json::from_slice::<FileMeta>(&v).ok()
                    .filter(|m| m.category == "image" && Path::new(&m.path).exists())
                    .map(|m| (hash, m.path))
            })
            .collect()
    };

    if images.is_empty() { return Ok(vec![]); }

    // Compute perceptual hashes for all images
    let mut phashes: Vec<(String, String, u64)> = Vec::new(); // (blake_hash, path, phash)
    for (blake_hash, path) in &images {
        if let Ok(ph) = perceptual_hash(path) {
            phashes.push((blake_hash.clone(), path.clone(), ph));
        }
    }

    // Find groups using union-find style grouping
    let n = phashes.len();
    let mut group_id = vec![usize::MAX; n];
    let mut next_group = 0usize;

    for i in 0..n {
        for j in (i+1)..n {
            let dist = hamming_distance(phashes[i].2, phashes[j].2);
            if dist <= threshold {
                match (group_id[i], group_id[j]) {
                    (usize::MAX, usize::MAX) => {
                        group_id[i] = next_group;
                        group_id[j] = next_group;
                        next_group += 1;
                    }
                    (g, usize::MAX) => { group_id[j] = g; }
                    (usize::MAX, g) => { group_id[i] = g; }
                    (gi, gj) if gi != gj => {
                        // Merge groups: relabel all gj -> gi
                        for k in 0..n { if group_id[k] == gj { group_id[k] = gi; } }
                    }
                    _ => {}
                }
            }
        }
    }

    // Collect groups
    let mut groups: std::collections::HashMap<usize, Vec<usize>> = std::collections::HashMap::new();
    for (i, &gid) in group_id.iter().enumerate() {
        if gid != usize::MAX { groups.entry(gid).or_default().push(i); }
    }

    // Build result: pick "best" = largest file size as representative
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut result = Vec::new();
    for (_, indices) in groups {
        if indices.len() < 2 { continue; }

        // Pick best by size
        let best_idx = indices.iter().copied().max_by_key(|&i| {
            let path = &phashes[i].1;
            fs::metadata(path).map(|m| m.len()).unwrap_or(0)
        }).unwrap();

        let best_hash = phashes[best_idx].0.clone();
        let others: Vec<String> = indices.iter()
            .filter(|&&i| i != best_idx)
            .map(|&i| phashes[i].0.clone())
            .collect();

        // Compute average similarity pct across all pairs
        let max_ham = 64u32;
        let avg_dist = if indices.len() < 2 { 0 } else {
            let mut total = 0u32;
            let mut pairs = 0u32;
            for &a in &indices {
                for &b in &indices {
                    if a < b {
                        total += hamming_distance(phashes[a].2, phashes[b].2);
                        pairs += 1;
                    }
                }
            }
            if pairs > 0 { total / pairs } else { 0 }
        };
        let similarity_pct = ((max_ham - avg_dist) * 100 / max_ham) as u32;

        result.push((best_hash, others, similarity_pct));
    }

    // Sort by group size descending
    result.sort_by(|a, b| b.1.len().cmp(&a.1.len()));
    Ok(result)
}

// ── SCAN + AUTO SNAPSHOT ───────────────────────────────────────

#[tauri::command]
async fn start_auto_scan(
    folder_path: String,
    snapshot_name: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let timestamp = now_ts();
    let mut count = 0usize;

    let previous: Vec<(String, FileMeta)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let norm = folder_path.replace('\\', "/").to_lowercase();
        db.iter().filter_map(|i| i.ok()).filter_map(|(k, v)| {
            let hash = String::from_utf8_lossy(&k).to_string();
            serde_json::from_slice::<FileMeta>(&v).ok().map(|m| (hash, m))
        }).filter(|(_, m)| m.path.replace('\\', "/").to_lowercase().starts_with(&norm)).collect()
    };

    let mut scanned = std::collections::HashSet::new();

    for entry in WalkDir::new(&folder_path).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() { continue; }
        let path = entry.path().to_string_lossy().to_string();
        let metadata = fs::metadata(entry.path()).ok();
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = format!("{:?}", metadata.as_ref().and_then(|m| m.modified().ok()).unwrap_or(SystemTime::now()));
        let category = get_category(&path);
        if let Ok(hash) = calculate_hash(&path) {
            scanned.insert(hash.clone());
let meta = FileMeta { 
    path: path.to_string(), // Convert &str to String
    size, 
    modified, 
    category 
};
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db.insert(hash.as_bytes(), serde_json::to_string(&meta).unwrap().as_bytes()).unwrap();
            count += 1;
        }
    }

    for (hash, meta) in &previous {
        if !scanned.contains(hash) && !Path::new(&meta.path).exists() {
            let name = meta.path.split(|c| c == '/' || c == '\\').last().unwrap_or("").to_string();
            let entry = DeletedEntry { hash: hash.clone(), path: meta.path.clone(), name, size: meta.size, category: meta.category.clone(), deleted_at: timestamp, snapshot_name: snapshot_name.clone() };
            let del_key = format!("deleted::{}::{}", timestamp, hash);
            { let vdb = state.version_db.lock().map_err(|e| e.to_string())?; vdb.insert(del_key.as_bytes(), serde_json::to_string(&entry).unwrap().as_bytes()).unwrap(); }
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db.remove(hash.as_bytes()).unwrap();
        }
    }

    let snap = SnapshotInfo { name: snapshot_name.clone(), timestamp, file_count: count, folder_path };
    let snap_key = format!("snapshot::{}::{}", timestamp, snapshot_name);
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    vdb.insert(snap_key.as_bytes(), serde_json::to_string(&snap).unwrap().as_bytes()).unwrap();

    Ok(format!("Indexed {} files. Snapshot '{}' saved.", count, snapshot_name))
}

// ── VAULT ──────────────────────────────────────────────────────

#[tauri::command]
fn get_all_stored_files(state: State<'_, AppState>) -> Result<Vec<(String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    Ok(db.iter().filter_map(|i| i.ok()).map(|(k, v)| (
        String::from_utf8_lossy(&k).to_string(),
        String::from_utf8_lossy(&v).to_string(),
    )).collect())
}

#[tauri::command]
fn clear_vault(state: State<'_, AppState>) -> Result<(), String> {
    state.db.lock().map_err(|e| e.to_string())?.clear().map_err(|e| e.to_string())
}

// ── HISTORY ────────────────────────────────────────────────────

#[tauri::command]
fn get_deleted_files(state: State<'_, AppState>) -> Result<Vec<DeletedEntry>, String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    let mut deleted: Vec<DeletedEntry> = vdb.scan_prefix(b"deleted::").filter_map(|i| i.ok()).filter_map(|(_, v)| serde_json::from_slice::<DeletedEntry>(&v).ok()).collect();
    deleted.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(deleted)
}

#[tauri::command]
fn clear_deleted_history(state: State<'_, AppState>) -> Result<(), String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    let keys: Vec<_> = vdb.scan_prefix(b"deleted::").filter_map(|i| i.ok().map(|(k, _)| k)).collect();
    for key in keys { vdb.remove(key).map_err(|e| e.to_string())?; }
    Ok(())
}

// ── SNAPSHOTS ─────────────────────────────────────────────────

#[tauri::command]
fn get_snapshots(state: State<'_, AppState>) -> Result<Vec<SnapshotInfo>, String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    let mut snaps: Vec<SnapshotInfo> = vdb.scan_prefix(b"snapshot::").filter_map(|i| i.ok()).filter_map(|(_, v)| serde_json::from_slice::<SnapshotInfo>(&v).ok()).collect();
    snaps.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(snaps)
}

#[tauri::command]
fn delete_snapshot(snapshot_name: String, timestamp: u64, state: State<'_, AppState>) -> Result<(), String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    vdb.remove(format!("snapshot::{}::{}", timestamp, snapshot_name).as_bytes()).map_err(|e| e.to_string())?;
    vdb.flush().map_err(|e| e.to_string())?;
    Ok(())
}

// ── ENTRY POINT ────────────────────────────────────────────────

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let data_dir = app.path().app_data_dir().unwrap();
            fs::create_dir_all(&data_dir).unwrap();
            let db = sled::open(data_dir.join("vault_v8")).expect("DB open failed");
            let version_db = sled::open(data_dir.join("vault_v8_history")).expect("History DB open failed");
            app.manage(AppState { db: Mutex::new(db), version_db: Mutex::new(version_db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file, open_file_with, check_file_status,
            get_file_properties, get_folder_properties,
            add_single_file,
            rename_in_index, rename_folder,
            delete_to_bin, delete_folder_to_bin, delete_physical_file,
            move_file, move_folder,
            compress_to_zip, extract_zip,
            find_similar_images,
            start_auto_scan, get_all_stored_files, clear_vault,
            get_deleted_files, clear_deleted_history,
            get_snapshots, delete_snapshot,
        ])
        .run(tauri::generate_context!())
        .expect("tauri error")
}