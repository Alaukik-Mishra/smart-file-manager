use blake3::Hasher;
use sled::Db;
use std::fs::{self, File};
use std::io::Read;
use std::sync::Mutex;
use tauri::{Manager, State};
use walkdir::WalkDir;
use serde::{Serialize, Deserialize};
use std::time::{SystemTime, UNIX_EPOCH};

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

pub struct AppState {
    pub db: Mutex<Db>,
    pub version_db: Mutex<Db>,
}

fn now_ts() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs()
}

fn get_category(path: &str) -> String {
    let ext = path.rsplit('.').next().unwrap_or("").to_lowercase();
    match ext.as_str() {
        "jpg"|"jpeg"|"png"|"gif"|"webp"|"bmp"|"svg"|"ico" => "image",
        "mp4"|"mkv"|"mov"|"avi"|"wmv"|"webm"|"flv"       => "video",
        "pdf"|"doc"|"docx"|"txt"|"xlsx"|"xls"|"pptx"|"csv"|"md" => "document",
        "mp3"|"wav"|"flac"|"aac"|"ogg"|"m4a"             => "audio",
        "zip"|"rar"|"7z"|"tar"|"gz"|"bz2"                => "archive",
        "exe"|"msi"|"dmg"|"deb"                          => "executable",
        _                                                  => "other",
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

// ── FILE COMMANDS ──────────────────────────────────────────────

#[tauri::command]
fn open_file(path: String) -> Result<(), String> {
    opener::open(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn check_file_status(path: String) -> bool {
    std::path::Path::new(&path).exists()
}

#[tauri::command]
fn get_file_properties(hash: String, state: State<'_, AppState>) -> Result<FileProperties, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let v = db.get(hash.as_bytes())
        .map_err(|e| e.to_string())?
        .ok_or("Hash not found in vault")?;
    let meta: FileMeta = serde_json::from_slice(&v).map_err(|e| e.to_string())?;
    let name = meta.path.split(|c| c == '/' || c == '\\')
        .last().unwrap_or("").to_string();
    let exists = std::path::Path::new(&meta.path).exists();
    Ok(FileProperties {
        path: meta.path, name, size: meta.size,
        hash, modified: meta.modified, category: meta.category,
        exists_on_disk: exists,
    })
}

#[tauri::command]
fn rename_in_index(hash: String, new_name: String, state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let v = db.get(hash.as_bytes())
        .map_err(|e| e.to_string())?
        .ok_or("Hash not found")?;
    let mut meta: FileMeta = serde_json::from_slice(&v).map_err(|e| e.to_string())?;
    let old_path = std::path::Path::new(&meta.path);
    let new_path = old_path.parent()
        .ok_or("Cannot determine parent path")?
        .join(&new_name);
    if old_path.exists() {
        fs::rename(old_path, &new_path).map_err(|e| e.to_string())?;
    }
    meta.path = new_path.to_string_lossy().to_string();
    let encoded = serde_json::to_string(&meta).map_err(|e| e.to_string())?;
    db.insert(hash.as_bytes(), encoded.as_bytes()).map_err(|e| e.to_string())?;
    db.flush().map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
fn delete_physical_file(hash: String, path: String, state: State<'_, AppState>) -> Result<(), String> {
    let name = path.split(|c| c == '/' || c == '\\')
        .last().unwrap_or("unknown").to_string();
    let size = fs::metadata(&path).map(|m| m.len()).unwrap_or(0);
    let category = get_category(&path);
    let entry = DeletedEntry {
        hash: hash.clone(), path: path.clone(), name,
        size, category, deleted_at: now_ts(),
        snapshot_name: "manual".to_string(),
    };
    let del_key = format!("deleted::{}::{}", now_ts(), hash);
    let encoded = serde_json::to_string(&entry).unwrap();
    {
        let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
        vdb.insert(del_key.as_bytes(), encoded.as_bytes()).unwrap();
    }
    if std::path::Path::new(&path).exists() {
        fs::remove_file(&path).map_err(|e| e.to_string())?;
    }
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.remove(hash.as_bytes()).map_err(|e| e.to_string())?;
    Ok(())
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

    // Remember what was in vault for this folder before scan
    let previous: Vec<(String, FileMeta)> = {
        let db = state.db.lock().map_err(|e| e.to_string())?;
        let norm = folder_path.replace('\\', "/").to_lowercase();
        db.iter()
            .filter_map(|i| i.ok())
            .filter_map(|(k, v)| {
                let hash = String::from_utf8_lossy(&k).to_string();
                serde_json::from_slice::<FileMeta>(&v).ok().map(|m| (hash, m))
            })
            .filter(|(_, m)| m.path.replace('\\', "/").to_lowercase().starts_with(&norm))
            .collect()
    };

    let mut scanned = std::collections::HashSet::new();

    for entry in WalkDir::new(&folder_path).into_iter().filter_map(|e| e.ok()) {
        if !entry.file_type().is_file() { continue; }
        let path = entry.path().to_string_lossy().to_string();
        let metadata = fs::metadata(entry.path()).ok();
        let size = metadata.as_ref().map(|m| m.len()).unwrap_or(0);
        let modified = format!("{:?}",
            metadata.as_ref().and_then(|m| m.modified().ok()).unwrap_or(SystemTime::now()));
        let category = get_category(&path);

        if let Ok(hash) = calculate_hash(&path) {
            scanned.insert(hash.clone());
            let meta = FileMeta { path, size, modified, category };
            let encoded = serde_json::to_string(&meta).unwrap();
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db.insert(hash.as_bytes(), encoded.as_bytes()).unwrap();
            count += 1;
        }
    }

    // Files that were indexed before but are now gone → deleted
    for (hash, meta) in &previous {
        if !scanned.contains(hash) && !std::path::Path::new(&meta.path).exists() {
            let name = meta.path.split(|c| c == '/' || c == '\\')
                .last().unwrap_or("unknown").to_string();
            let entry = DeletedEntry {
                hash: hash.clone(), path: meta.path.clone(), name,
                size: meta.size, category: meta.category.clone(),
                deleted_at: timestamp, snapshot_name: snapshot_name.clone(),
            };
            let del_key = format!("deleted::{}::{}", timestamp, hash);
            let enc = serde_json::to_string(&entry).unwrap();
            {
                let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
                vdb.insert(del_key.as_bytes(), enc.as_bytes()).unwrap();
            }
            let db = state.db.lock().map_err(|e| e.to_string())?;
            db.remove(hash.as_bytes()).unwrap();
        }
    }

    // Save snapshot summary
    let snap = SnapshotInfo {
        name: snapshot_name.clone(),
        timestamp,
        file_count: count,
        folder_path: folder_path.clone(),
    };
    let snap_key = format!("snapshot::{}::{}", timestamp, snapshot_name);
    let snap_enc = serde_json::to_string(&snap).unwrap();
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    vdb.insert(snap_key.as_bytes(), snap_enc.as_bytes()).unwrap();

    Ok(format!("Indexed {} files. Snapshot '{}' saved automatically.", count, snapshot_name))
}

// ── VAULT ──────────────────────────────────────────────────────

#[tauri::command]
fn get_all_stored_files(state: State<'_, AppState>) -> Result<Vec<(String, String)>, String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    let mut files = Vec::new();
    for item in db.iter() {
        if let Ok((k, v)) = item {
            files.push((
                String::from_utf8_lossy(&k).to_string(),
                String::from_utf8_lossy(&v).to_string(),
            ));
        }
    }
    Ok(files)
}

#[tauri::command]
fn clear_vault(state: State<'_, AppState>) -> Result<(), String> {
    let db = state.db.lock().map_err(|e| e.to_string())?;
    db.clear().map_err(|e| e.to_string())?;
    Ok(())
}

// ── DELETED HISTORY ────────────────────────────────────────────

#[tauri::command]
fn get_deleted_files(state: State<'_, AppState>) -> Result<Vec<DeletedEntry>, String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    let mut deleted: Vec<DeletedEntry> = vdb.scan_prefix(b"deleted::")
        .filter_map(|i| i.ok())
        .filter_map(|(_, v)| serde_json::from_slice::<DeletedEntry>(&v).ok())
        .collect();
    deleted.sort_by(|a, b| b.deleted_at.cmp(&a.deleted_at));
    Ok(deleted)
}

#[tauri::command]
fn clear_deleted_history(state: State<'_, AppState>) -> Result<(), String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    let keys: Vec<_> = vdb.scan_prefix(b"deleted::")
        .filter_map(|i| i.ok().map(|(k, _)| k))
        .collect();
    for key in keys { vdb.remove(key).map_err(|e| e.to_string())?; }
    Ok(())
}

// ── SNAPSHOTS ─────────────────────────────────────────────────

#[tauri::command]
fn get_snapshots(state: State<'_, AppState>) -> Result<Vec<SnapshotInfo>, String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    let mut snaps: Vec<SnapshotInfo> = vdb.scan_prefix(b"snapshot::")
        .filter_map(|i| i.ok())
        .filter_map(|(_, v)| serde_json::from_slice::<SnapshotInfo>(&v).ok())
        .collect();
    snaps.sort_by(|a, b| b.timestamp.cmp(&a.timestamp));
    Ok(snaps)
}

#[tauri::command]
fn delete_snapshot(snapshot_name: String, timestamp: u64, state: State<'_, AppState>) -> Result<(), String> {
    let vdb = state.version_db.lock().map_err(|e| e.to_string())?;
    let key = format!("snapshot::{}::{}", timestamp, snapshot_name);
    vdb.remove(key.as_bytes()).map_err(|e| e.to_string())?;
    vdb.flush().map_err(|e| e.to_string())?;
    Ok(())
}

// ── INTEGRITY CHECK ────────────────────────────────────────────

#[tauri::command]
async fn run_integrity_check(state: State<'_, AppState>) -> Result<Vec<String>, String> {
    let db = state.db.lock().unwrap();
    let mut corrupted = Vec::new();
    for item in db.iter() {
        let (k, v) = item.unwrap();
        let stored = String::from_utf8_lossy(&k).to_string();
        let meta: FileMeta = serde_json::from_slice(&v).unwrap();
        if std::path::Path::new(&meta.path).exists() {
            if let Ok(new_hash) = calculate_hash(&meta.path) {
                if new_hash != stored { corrupted.push(meta.path); }
            }
        }
    }
    Ok(corrupted)
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
            let db = sled::open(data_dir.join("vault_v6")).expect("Failed to open DB");
            let version_db = sled::open(data_dir.join("vault_v6_history")).expect("Failed to open history DB");
            app.manage(AppState { db: Mutex::new(db), version_db: Mutex::new(version_db) });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            open_file, check_file_status,
            get_file_properties, rename_in_index, delete_physical_file,
            start_auto_scan, get_all_stored_files, clear_vault,
            get_deleted_files, clear_deleted_history,
            get_snapshots, delete_snapshot,
            run_integrity_check,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}