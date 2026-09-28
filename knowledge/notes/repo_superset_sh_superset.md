# 📚 Catatan Pengetahuan: superset-sh/superset

- **URL:** https://github.com/superset-sh/superset.git
- **Waktu Dipelajari:** 25/9/2026, 18.21.52
- **Tags:** superset-sh, superset, agentic-ide, multi-agent, git-worktree, monorepo, bun, turbo, claude-code, codex, plugin-marketplace, electron-desktop
- **Ringkasan:** Superset adalah sebuah agentic IDE desktop yang mengorkestrasi banyak coding agent CLI (Claude Code, Codex, OpenCode, dll.) secara paralel dalam satu workspace per-task. Setiap task dijalankan di Git worktree terpisah dengan terminal, diff viewer, browser preview, dan akses plugin (GitHub, Linear, Notion, Slack, Gmail) sehingga pengguna dapat menjalankan puluhan agent sekaligus menggunakan subscription pribadi masing-masing. Repo ini merupakan monorepo Bun + Turbo berisi aplikasi desktop (Electron), web, docs, marketing, API, relay, CLI, plugin marketplace, dan kumpulan Skills untuk agent.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Positioning Produk
Superset adalah **agentic IDE**: aplikasi desktop yang menjadi "shell" untuk menjalankan *banyak* CLI coding agent (Claude Code, Codex, OpenCode, dll.) secara bersamaan, bukan menggantikan mereka. Falsafah inti:
> "Run any agent with your own subscription."

Artinya Superset bukan model provider; ia adalah **orchestrator UI + filesystem isolation layer** di atas agent CLI yang sudah ada.

## 1.2 Topologi Monorepo
Berdasarkan `package.json` dan struktur file:

```
superset/ (root, private, @superset/repo)
├── apps/
│   ├── desktop/      # Electron app (target utama: macOS, Linux eksperimental)
│   ├── web/          # Superset web companion
│   ├── marketing/    # situs superset.sh
│   ├── docs/         # docs.superset.sh (Fumadocs, lihat cli.json)
│   ├── api/          # backend API
│   └── relay/        # relay server (kemungkinan untuk Pages / kolaborasi)
├── packages/         # shared libs, UI (ui-add), tipe, dsb.
├── plugins/          # github, linear, notion, slack, gmail
├── scripts/          # dev, release, sync-dev-skills, check-dev-ports
├── .agents/          # commands + skills (source of truth)
├── .claude/          # mirror untuk Claude Code
├── .codex/           # mirror untuk Codex
├── .cursor/          # mirror untuk Cursor
├── .mastracode/      # konfigurasi Mastra + mcp.json
└── .superset/        # setup scripts (local & cloud) + dev-stack
```

Script `dev` sangat deskriptif tentang produk inti:
```json
"dev": "turbo run dev --filter=@superset/api --filter=@superset/web --filter=@superset/desktop --filter=//"
```
Hanya **api + web + desktop** yang di-dev secara default; marketing/docs/relay punya script sendiri (`dev:marketing`, `dev:docs`, `dev:relay`). Ini menandakan desktop adalah produk utama.

## 1.3 Model Eksekusi: Workspace = Git Worktree
README menegaskan:
> "Give each task a Git worktree with its own branch and terminals. Worktrees separate working files; they do not sandbox processes or prevent merge conflicts."

Konsekuensi arsitektural penting:
- **Isolasi file** (bukan isolasi proses) — agent tetap berbagi OS, port, network.
- **Port detection per workspace** — setiap worktree punya dev server preview sendiri (lihat `check-dev-ports.ts` di `predev`).
- **Branch per task** — mempermudah diff review dan PR flow yang native.

## 1.4 Layer Multi-Agent
Direktori `.agents/`, `.claude/`, `.codex/`, `.cursor/` menunjukkan *dual-source strategy*: `.agents/` adalah katalog netral-agent, lalu disinkronkan ke format masing-masing vendor via `bun scripts/sync-dev-skills.ts`. `.mastracode/mcp.json` menandakan agent berbasis Mastra (JS/TS) juga didukung.

## 1.5 Alur Kerja Utama (Agentic Loop)
1. **Ingest task** — user menulis deskripsi di workspace baru → Superset membuat worktree + branch.
2. **Dispatch agent** — CLI agent pilihan (Claude Code / Codex / OpenCode) dijalankan di terminal worktree.
3. **Review diff** — panel *Changes* menampilkan patch; user bisa comment / edit langsung.
4. **Run tests** — terminal kedua/ketiga untuk menjalankan test suite spesifik.
5. **Preview** — browser pane mengintip dev server pada port yang dideteksi otomatis.
6. **Feedback loop** — *Design Mode* di browser pane menyeleksi elemen UI dan mengirim konteks DOM ke agent; *PR review* bisa mem-parse diff GitHub untuk dikirim sebagai feedback ke agent.
7. **Commit / push / PR** — dilakukan langsung dari diff viewer, `gh` opsional.

## 1.6 Distribusi & Rilis
- `release.ts`, `release:desktop`, `release:cli`, `release:canary` — tiga channel artefak (desktop DMG/AppImage, CLI npm, canary).
- `check-versions.ts` untuk konsistensi versi antar package.
- `@vercel/sandbox` sebagai devDependency → mengindikasikan eksekusi agent bisa dialihkan ke sandbox cloud Vercel (lihat `.superset/setup.cloud.sh`).

---

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Deklaratif Marketplace via JSON Schema
`.agent-marketplace.json` merujuk ke `$schema: https://superset.sh/schemas/marketplace/1.0.0.json`. Ini pola **schema-first plugin distribution**:
- Plugin = file/folder lokal (`source: "./plugins/github"`) dengan metadata lengkap (author, kategori, versi).
- Ada field `"renames": {}` — fitur migrasi nama plugin tanpa breaking downstream, pola kompatibilitas serupa `package.json` `browser` / `exports`.
- `"featured": ["github", "linear"]` memisahkan metadata kurasi dari katalog lengkap.

Keunggulan: marketplace dapat di-serve dari static JSON (tanpa backend berat), di-cache, dan diverifikasi schema.

## 2.2 Dual-Source Skills Sync
`.agents/` sebagai *canonical*, disinkronkan ke `.claude/skills`, `.codex/commands`,

---
### Struktur Berkas Utama
```
📄 .agent-marketplace.json
📁 .agents/
   └─ 📁 commands
   └─ 📁 skills
📄 .bun-version
📁 .claude/
   └─ 📁 agents
   └─ 📄 commands
   └─ 📄 settings.json
   └─ 📄 skills
📁 .claude-plugin/
   └─ 📄 marketplace.json
📁 .codex/
   └─ 📄 commands
   └─ 📄 config.toml
   └─ 📄 prompts
📁 .cursor/
   └─ 📄 commands
📄 .dockerignore
📄 .env.example
📄 .env.local.example
📄 .gitignore
📁 .mastracode/
   └─ 📄 mcp.json
📁 .superset/
   └─ 📄 config.json
   └─ 📄 dev-stack.cloud.sh
   └─ 📁 lib
   └─ 📄 setup.cloud.sh
   └─ 📄 setup.local.sh
   └─ 📄 setup.sh
   └─ 📄 teardown.local.sh
   └─ 📄 teardown.sh
📄 AGENTS.md
📄 CLAUDE.md
```
