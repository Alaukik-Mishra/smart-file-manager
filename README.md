# ◈ VAULT: Smart File Manager & CAS Engine
### 🏗️ Architected by Alaukik Mishra

VAULT is a next-generation local file management system that moves beyond simple path-based indexing. By utilizing **Content-Addressable Storage (CAS)** and **Perceptual Hashing**, VAULT understands *what* your files are, not just *where* they are located.

---

## 🚀 The "10x" Technical Core

This project was engineered for extreme performance and data integrity using the Rust ecosystem.

### 1. Content-Addressable Storage (CAS)
Unlike traditional managers, VAULT indexes files by their **BLAKE3 cryptographic hash**. 



* **Instant Deduplication:** Identical files across different folders are identified immediately.
* **Integrity Tracking:** Automatically detects if a file has been corrupted or modified.
* **Flat-File Logic:** Decouples file identity from the OS-level file name.

### 2. Computer Vision: Perceptual Hashing (pHash)
Alaukik implemented a custom **Discrete Cosine Transform (DCT)** based perceptual hashing algorithm. This allows the system to "see" images as frequency data rather than just raw pixels.



* **Visual Similarity:** Detects images that look the same even if they are different sizes, formats, or compression levels.
* **Signal Analysis:** Converts image data into a 64-bit frequency signature for **Hamming distance** comparison.

### 3. Persistent Systems Layer
* **Sled DB:** Uses a high-performance, lock-free, embedded Key-Value store for ACID-compliant metadata storage.
* **Multi-threaded Safety:** Implements strict Rust `Mutex` patterns to ensure thread-safe access to the database during heavy indexing.



---

## 🛠️ Tech Stack
- **Backend:** Rust, Tauri v2 (High-performance systems logic)
- **Frontend:** React, TypeScript, CSS Modules (Modular component architecture)
- **Database:** Sled (Embedded KV Store)
- **Algorithms:** BLAKE3 (Hashing), DCT (Perceptual Analysis)

## 🏗️ Project Architecture
The project is split into a **Modular React UI** and a **Systems-level Rust Backend**, communicating via an asynchronous IPC (Inter-Process Communication) bridge. This ensures the UI stays responsive even during heavy cryptographic operations.



---

## ⚙️ Installation & Development

```bash
# Clone the repo
git clone [https://github.com/Alaukik-Mishra/smart-file-manager.git](https://github.com/Alaukik-Mishra/smart-file-manager.git)

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
