# 📚 Catatan Pengetahuan: stablyai/orca

- **URL:** https://github.com/stablyai/orca.git
- **Waktu Dipelajari:** 28/9/2026, 06.18.49
- **Tags:** stablyai, orca, agentic-ide, parallel-agents, electron, worktrees, multi-agent, ade, terminal, mobile-companion, orchestrator
- **Ringkasan:** Orca adalah Agentic Development Environment (ADE) berbasis Electron yang memungkinkan developer menjalankan banyak coding agent (Codex, Claude Code, OpenCode, Pi) secara paralel, masing-masing di git worktree terisolasi, dengan terminal kelas Ghostty, mode Design untuk capture UI, serta companion app mobile & remote runtime untuk mengontrol fleet agent dari mana saja.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Posisi Produk
Orca diposisikan sebagai **"AI Orchestrator for 100x builders"** — bukan sekadar IDE, melainkan **ADE (Agentic Development Environment)**. Nilai utama: menjalankan *fleet* agent secara paralel tanpa mengunci user ke satu vendor model. User membawa subscription sendiri (Codex / Claude Code / OpenCode / Pi) dan Orca mengoordinasikan semuanya.

## 1.2 Topologi Runtime
Berdasarkan struktur folder dan `package.json`:

```
orca/
├── src/                    (kode sumber utama, linted via oxlint)
├── out/                    (hasil build: main, cli, preload, renderer)
│   ├── main/index.js       (entry Electron main process)
│   └── cli/index.js        (binary "orca")
├── cloud/                  (runtime remote / cloud backend, dockerised)
├── mobile/                 (companion app — iOS/Android)
├── config/                 (build plugins, electron-builder, docker, scripts)
├── Casks/orca.rb           (Homebrew Cask untuk macOS)
└── resources/              (icons, onboarding assets)
```

Tiga **surface** utama produk:
1. **Desktop** (Electron, Windows/macOS/Linux) — hunian utama.
2. **Mobile** (iOS App Store, TestFlight, Android APK) — companion monitoring/steering.
3. **Remote runtime** (`cloud/` + Docker) — eksekusi agent di server, dapat di-drive dari desktop maupun mobile.

## 1.3 Model Paralelisme: Worktree-per-Agent
Ini adalah *core architectural decision* Orca. Alih-alih menjalankan agent dalam satu branch, Orca:
1. Menerima satu prompt dari user.
2. Mem-fan-out prompt ke beberapa agent (masing-masing engine berbeda).
3. Membuat **git worktree terisolasi** per agent — tiap agent beroperasi di filesystem & branch sendiri.
4. Menampilkan hasil per worktree di UI tab-split untuk dibandingkan.
5. User memilih pemenang → merge.

Konsekuensi arsitektural: state manajemen worktree harus persisten (scrollback & sesi survive restart), dan perlu orchestrator yang bisa spawn/kill proses agent tanpa race condition.

## 1.4 Lapisan Lint & Gate sebagai "Design Contract"
Repo ini memakai lint *sebagai kontrak arsitektur*, bukan hanya style. Perhatikan plugin kustom di `.oxlintrc.json`:
- `app-store-performance` — aturan Redux-style selector (mencegah re-render).
- `quadratic-buffer-concat` — mendeteksi `buf = buf.concat(...)` dalam loop (O(n²)).
- `sort-comparator-performance` — mencegah membuat `Intl.Collator` berulang.
- `renderer-scrollbar-style` — konsistensi tema scrollbar renderer.
- `mobile-pairing-qrcode-import` — mencegah import palsu modul pairing.

Ditambah ratchet checks (`check:max-lines-ratchet`, `check:ts-nocheck-ratchet`, `check:runtime-electron-ratchet`) — ukuran file dan penggunaan `@ts-nocheck` serta API Electron *dibatasi agar tidak bertambah*, memaksa refactor berkelanjutan.

## 1.5 Keamanan & Supply Chain
- `cloud/.gitleaks.toml` + `.trufflehog-*` = secret scanning ganda sebelum commit.
- `.husky/pre-commit` menjalankan gate cepat.
- `pnpm dlx react-doctor ... --no-supply-chain --no-telemetry` = analisis React tanpa mengirim data ke pihak ketiga.

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Electron Multi-Target Build
`config/electron-vite-target.config.cts` + `config/electron-builder.config.cjs` memisahkan konfigurasi build menurut target (main/preload/renderer) dan platform (mac/win/linux). `install:release` menggunakan flag `--cpu=current,x64,arm64` — dibundel *native binary* untuk semua arsitektur CPU (khususnya ripgrep & modul native lain) dalam satu instalasi.

## 2.2 Bundled Ripgrep
`config/bundled-ripgrep-resources.cjs` menunjukkan bahwa ripgrep di-bundel sebagai resource (bukan dipanggil dari PATH user). Ini penting untuk ADE — pencarian cepat lintas worktree tidak boleh bergantung pada environment user. Tren ini terlihat juga di `.github/scripts/e2e-with-window-manager.sh` yang memanggil `rg` untuk cek X11 property.

## 2.3 Headless E2E dengan Window Manager
Skrip berikut menandakan pengujian E2E di Linux headless (Xvfb) membutuhkan window manager nyata (openbox) karena Electron butuh `_NET_SUPPORTING_WM_CHECK`. Ini pola penting: **CI tanpa display tetap butuh WM** agar Electron mau jalan.

## 2.4 Format-on-Write dengan Constraint Eksplisit
`oxfmt` dikonfigurasi `singleQuote`, `semi: false`, `printWidth: 100`, `trailingComma: none` — *style* yang menekankan diff minimal (tanpa trailing comma & semicolon, sehingga perubahan satu baris tidak memicu reflow tetangga). Folder `cloud/`, `resources/licenses/`, dan plugin lokal di-ignore.

## 2.5 Skill Bundle & RPC Params Catalog
Script `verify:rpc-params-catalog`, `verify:bundled-skill-guides`, `verify:skill-bundle-manifest` menunjukkan Orca *mem-bundel* "skill guide" (prompt/system instructions untuk tiap agent engine) dan **memverifikasi katalog RPC** antar proses. Ini pola kuat: prompt agent diperlakukan sebagai artifact yang di-version & di-validasi, bukan string literal tersebar.

## 2.6 Localization dengan Coverage Gate
Tiga verifikasi terpisah: `verify:localization-catalogs`, `verify:localization-extraction`, `verify:localization-coverage`. Artinya:
- Semua string user-facing harus diekstraksi ke katalog.
- Tidak boleh ada string hardcoded yang lolos.
- Setiap locale harus cover 100% key.
Ini memaksa disiplin i18n sejak awal (dibuktikan oleh README multi-bahasa: zh-CN, ja, ko, es, fr, pt).

# 3. Cuplikan Kode Kunci & Cara Kerja Fungsi

## 3.1 E2E Window Manager Bootstrap
```bash
# .github/scripts/e2e-with-window-manager.sh
set -euo pipefail
openbox --sm-disable > /tmp/orca-e2e-window-manager.log 2>&1 &
wm_pid=$!
trap cleanup EXIT
ready=false
for attempt in {1..100}; do
  if xprop -root _NET_SUPPORTING_WM_CHECK 2>/dev/null \
     | rg -q 'window id # 0x[1-9a-fA-F]'; then
    ready=true; break
  fi
  if ! kill -0 "$wm_pid" 2>/dev/null; then
    cat /tmp/orca-e2e-window-manager.log
    exit 1
  fi
  sleep 0.1
done
[ "$ready" = true ] || { echo 'WM did not acquire Xvfb root window' >&2; exit 1; }
"$@

---
### Struktur Berkas Utama
```
📄 .gitattributes
📄 .gitignore
📁 .husky/
   └─ 📄 pre-commit
📄 .oxfmtrc.json
📄 .oxlintrc.json
📄 AGENTS.md
📄 CLAUDE.md
📁 Casks/
   └─ 📄 orca.rb
   └─ 📄 orca@rc.rb
📄 LICENSE
📄 README.md
📁 cloud/
   └─ 📄 .dockerignore
   └─ 📄 .editorconfig
   └─ 📄 .gitignore
   └─ 📄 .gitleaks.toml
   └─ 📄 .node-version
   └─ 📄 .npmrc
   └─ 📄 .trufflehog-exclude-paths.txt
   └─ 📄 .trufflehog-include-paths.txt
📄 components.json
📁 config/
   └─ 📁 build-plugins
   └─ 📄 bundled-ripgrep-resources.cjs
   └─ 📄 dev-app-update.yml
   └─ 📁 docker
   └─ 📄 electron-builder.config.cjs
   └─ 📄 electron-vite-target.config.cts
   └─ 📄 i18n-translation-source.md
   └─ 📄 i18next.config.ts
📁 docs/
   └─ 📄 STYLEGUIDE.md
   └─ 📄 agent-skill-sharing-implementation-checklist.md
```
