# 📚 Catatan Pengetahuan: Kuddev/pebrel

- **URL:** https://github.com/Kuddev/pebrel.git
- **Waktu Dipelajari:** 28/9/2026, 10.24.56
- **Tags:** rust, gpui, terminal-emulator, gpu-accelerated, ssh, sftp, ai-cli, split-panes, persistent-sessions, windows, zed-framework, opengl
- **Ringkasan:** Pebrel (sebelumnya Nebula) adalah terminal emulator native yang diakselerasi GPU, ditulis dengan Rust dan GPUI (framework UI dari Zed), yang menyatukan shell lokal, SSH/SFTP, persistent sessions, draggable split panes, dan alur kerja AI CLI (Claude Code, Codex, OpenCode) dalam satu workspace desktop untuk Windows, macOS, dan Linux. Repositori ini menonjol karena menjadikan sesi AI CLI sebagai warga kelas satu (first-class) — output agen dapat dipantau dan dibaca langsung tanpa berpindah aplikasi.

---

# 1. Konsep Utama & Arsitektur

Pebrel adalah **terminal emulator native** yang lebih tepat disebut "workspace desktop" daripada terminal klasik. Ia menyatukan empat domain yang biasanya terpisah menjadi satu aplikasi:

1. **Shell lokal** — eksekusi via PTY (pseudo-terminal) di OS host.
2. **Remote access** — klien SSH + SFTP bawaan, sehingga sesi remote terasa seperti sesi lokal (termasuk tab, split, dan scrollback).
3. **Persistent sessions** — sesi tetap hidup saat UI ditutup atau koneksi terputus, memungkinkan resume tanpa kehilangan state.
4. **AI CLI workflows** — Claude Code, Codex, OpenCode dijalankan di pane khusus yang dilacak aktivitasnya (bukan sekadar output teks mentah).

**Stack teknologi:**
- **Bahasa:** Rust (edition 2024) — memanfaatkan safety + zero-cost abstraction untuk loop render dan parsing terminal yang sensitif latensi.
- **UI Framework:** GPUI — framework UI retained-mode milik Zed Industries yang merender via GPU (OpenGL ES 2.0+ di semua platform). Ini adalah pilihan yang tidak biasa: alih-alih memakai winit/egui/tauri, Pebrel mengikuti jejak Zed Editor.
- **Target platform:** Windows 10/11, macOS 14+, Linux dengan glibc 2.35+.
- **Lisensi:** GPL-3.0 (copyleft kuat — semua turunan harus open-source dengan lisensi sama).

**Alur kerja tingkat tinggi:**
```
┌────────────────────────────────────────────────┐
│  GPUI App Shell (window, tabs, splits)         │
│  ┌──────────────┐  ┌──────────────┐            │
│  │ Pane (Claude)│  │ Pane (SSH)   │  ...       │
│  └──────┬───────┘  └──────┬───────┘            │
│         │                 │                    │
│   ┌─────▼─────┐    ┌──────▼──────┐             │
│   │ PTY Model │    │ SSH Channel │             │
│   │ (raw bytes│    │ (russh/etc) │             │
│   │  → parser │    │  → parser   │             │
│   └─────┬─────┘    └──────┬──────┘             │
│         └────────┬────────┘                    │
│           Terminal Grid (VT/xterm subset)      │
│                  │                             │
│           GPU renderer (glyph atlas, quads)    │
└────────────────────────────────────────────────┘
```

**Konsekuensi arsitektural penting:**
- Karena memakai GPUI, terminal bukan lagi "widget" sederhana — ia adalah entity yang punya state, layout constraint, dan lifecycle sendiri. Ini memungkinkan split pane yang benar-benar draggable dan tab dengan preview.
- "Native document reader" yang disebutkan di README menyiratkan ada modul parser dokumen (kemungkinan Markdown/PDF/EPUB) yang di-render lewat GPUI, bukan WebView.
- Pilihan target Linux dengan glibc ≥ 2.35 menunjukkan proyek mengandalkan API modern (kemungkinan `io_uring`-lite, `epoll` modern, atau fitur thread Rust terbaru).

# 2. Pola Desain & Teknik Coding Kunci

**a. Dekomposisi Model–View ala GPUI**
GPUI memisahkan `Model` (state yang di-observe) dan `View` (renderer). Pebrel kemungkinan memakai:
- `TerminalModel` — menyimpan grid karakter, cursor, scrollback buffer, mode (normal/alt screen), dan mengirim event ke view saat ada perubahan.
- `SessionModel` — menyimpan metadata sesi (nama, protokol: local/SSH/SFTP, status koneksi, PID).
- `WorkspaceModel` — pohon tab + split layout.

Pola ini memungkinkan **incremental rendering**: hanya cell yang berubah yang di-repaint, bukan seluruh frame.

**b. Parser terminal dengan buffer reuse**
Untuk throughput tinggi (misalnya output `cargo build` ribuan baris/detik), parser VT harus menghindari alokasi. Pola yang umum di terminal Rust modern:
- Reuse `Vec<u8>` untuk input chunk.
- State machine untuk escape sequence (CSI, OSC, DCS) dengan transisi match, bukan regex.
- `Cell` sebagai struct POD (packed) dengan warna + atribut (bold/italic/underline) dalam bitflag u32 agar cache-friendly.

**c. Backpressure & batching ke GPU**
Karena render GPU mahal bila dipanggil per-byte, Pebrel kemungkinan menerapkan:
- **Coalescing**: kumpulkan update PTY dalam window waktu kecil (mis. 8–16 ms, satu frame).
- **Dirty rectangle tracking**: hanya update glyph atlas untuk cell yang berubah.
- **Glyph atlas**: cache bitmap glyph per (font, size, style) sehingga rendering teks jadi lookup quad + UV koordinat, bukan rasterisasi ulang.

**d. Session persistence via proses terpisah**
Untuk "persistent sessions", ada dua pendekatan umum:
- **Daemon lokal** (mirip tmux) yang menyimpan PTY/session state, dengan Pebrel sebagai klien tipis.
- **Journaled state**: Pebrel menyimpan scrollback + layout ke disk dan me-respawn shell dengan cwd/env yang direstorasi (lebih sederhana, tapi proses mati saat app crash).

Mengingat target Windows-first, kemungkinan pendekatan kedua (journaled) lebih dominan, atau hybrid dengan ConPTY di Windows untuk persistent PTY.

**e. AI CLI sebagai "sibling" pane, bukan subprocess biasa**
Alih-alih hanya `Command::new("claude")`, ada kemungkinan Pebrel:
- Menjalankan AI CLI dalam pane dengan **prompt injection** atau **hook output parsing** — mengenali prompt tool (mis. `claude>`) untuk menyediakan UI tambahan (auto-scroll marker, status bar).
- Menjaga environment variable yang dibutuhkan (mis. `ANTHROPIC_API_KEY`, MCP config path) sehingga AI CLI dapat menemukan tool-nya.
- Menyediakan "activity indicator" dengan memonitor pola output (spinner Unicode, bell, atau escape sequence non-standar).

**

---
### Struktur Berkas Utama
```
📁 Kuddev/pebrel (via GitHub API)
```
