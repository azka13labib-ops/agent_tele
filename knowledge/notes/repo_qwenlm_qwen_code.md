# 📚 Catatan Pengetahuan: QwenLM/qwen-code

- **URL:** https://github.com/QwenLM/qwen-code.git
- **Waktu Dipelajari:** 27/9/2026, 09.51.31
- **Tags:** qwenlm, qwen-code, ai-coding-agent, terminal-agent, monorepo, mcp, subagents, multi-protocol, cli, pnpm-workspace, typescript, vs-code-extension, chat-integrations, auto-memory, auto-skills, agent-teams
- **Ringkasan:** Qwen Code adalah AI coding agent open-source yang berjalan di terminal, editor, desktop, browser, dan chat (Telegram/DingTalk/WeChat/Feishu). Dibangun sebagai monorepo pnpm/TypeScript dengan arsitektur berbasis skill, memory, goals, sub-agents, dan MCP, mendukung multi-protocol (OpenAI, Anthropic, Gemini, Qwen) serta model lokal (Ollama/vLLM). Repo ini dirancang agar agent dapat mengiterasi dirinya sendiri melalui workflow GitHub Actions autofix yang sangat matang.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Identitas & Positioning

Qwen Code (`@qwen-code/qwen-code`, versi saat ini `0.24.6`) adalah **AI coding agent open-source** yang berbeda dari pendahulunya (Gemini CLI, Claude Code) karena:

1. **Multi-surface**: bukan hanya terminal — juga editor (VS Code, Zed, JetBrains), desktop app, web UI, dan chat platforms (Telegram, DingTalk, WeChat, Feishu, QQ, WeCom).
2. **Multi-protocol**: dapat diarahkan ke API OpenAI, Anthropic, Gemini, Qwen, atau model lokal via Ollama/vLLM.
3. **Self-iterating**: repo ini secara aktif menggunakan agennya sendiri untuk filing issue, membuka PR, review code, dan menjalankan test — tercermin dari workflow `qwen-autofix.yml` yang sangat kompleks.

## 1.2 Struktur Monorepo

```
qwen-code/
├── packages/
│   ├── core/                    # Inti agen (agents, skills, memory, goals, tools)
│   ├── web-shell/               # Web UI (dev via Vite port 5174)
│   ├── desktop/                 # (di-exclude dari workspace publish)
│   ├── live-host/               # (di-exclude)
│   ├── mobile-shell/            # (di-exclude)
│   └── channels/
│       ├── base/                # Abstraksi channel
│       ├── telegram/ weixin/ dingtalk/ wecom/ feishu/ qqbot/
│       ├── github/ gitlab/ dws/
│       └── plugin-example/      # Template plugin
├── integrations/
│   ├── external-context/
│   └── external-context-mem0/   # Integrasi Mem0 untuk memory eksternal
├── scripts/                     # start.js, dev.js, build.js, generate-settings-schema.ts
└── .qwen/                       # Konfigurasi runtime agen: agents, skills, specs, e2e-tests
```

Struktur ini adalah **pola "archetypal plugin monorepo"**: core yang stabil, channel sebagai adapter, dan integrations sebagai expansion point.

## 1.3 Arsitektur Inti (`packages/core/src/`)

Berdasarkan `.github/issue-owners.json`, modul-modul inti adalah:

| Modul | Tanggung Jawab |
|---|---|
| `agents/` | Definisi sub-agent, eksekusi paralel |
| `skills/` | Auto-Skills — kemampuan agent yang dikomposisi |
| `memory/` | Auto-Memory — short & long-term context |
| `goals/` | Goal tracking / plan-and-execute loop |
| `telemetry/` | Observability (OpenTelemetry-compatible umumnya) |
| `extension/` | Plugin/extension loader |
| `config/` | Settings schema (digen via `generate-settings-schema.ts`) |
| `core/` | Loop agent, orchestrator |
| `services/` | LLM providers, transport |
| `tools/` | Tool calls (bash, edit, read, search, MCP) |
| `utils/` | Helpers |

**Alur kerja agen konseptual:**

```
User prompt
   ↓
[core loop]  → goal parsing
   ↓
[memory] read/write (Auto-Memory)
   ↓
[agents] spawn sub-agents (via MCP atau native)
   ↓
[tools] execute (bash / edit / read / search / MCP tool)
   ↓
[services] → LLM provider (multi-protocol)
   ↓
[extension] plugin hooks di setiap stage
   ↓
Output ke surface (terminal / chat / editor)
```

## 1.4 Kanal Chat sebagai First-Class Surface

Setiap direktori di `packages/channels/` merepresentasikan *transport adapter* yang menjembatani runtime agen ke UI eksternal:

- **Telegram / DingTalk / WeChat / Feishu / QQ / WeCom** — chat adapter untuk end-user non-developer.
- **GitHub / GitLab** — adapter untuk CI/PR automation (inilah yang digunakan oleh autofix workflow).
- **dws** — kemungkinan "DingTalk Work Space" atau semacamnya.
- **base** — abstraksi interface yang diimplementasi ulang oleh tiap adapter.
- **plugin-example** — reference untuk membangun channel baru.

Pola ini adalah **Strategy Pattern pada level workspace** — binding di `package.json` determines which channels are shipped.

## 1.5 Runtime Bootstrap

- `scripts/start.js` — entry `npm start`.
- `scripts/dev.js` — dev mode (hot reload).
- `scripts/dev/daemon-dev.js` — daemon dev (managed agent background).
- `scripts/build.js` — bundler terintegrasi dengan esbuild (`esbuild.config.js`) dan `copy_bundle_assets.js`.
- `scripts/build_sandbox.js` — build OCI image untuk sandbox eksekusi tool berbahaya.
- `scripts/build_vscode_companion.js` — build extension VS Code.

## 1.6 Model Sandboxing

Config `sandboxImageUri: ghcr.io/qwenlm/qwen-code:0.24.6` menunjukkan bahwa tool execution (bash, file write) dijalankan dalam container OCI terpisah. Ini adalah **capability-based sandbox**: host hanya menjalankan orchestrator, workload berjalan di container yang di-pin ke versi image yang sama dengan package.

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Trusted-Base Checkout Pattern (Supply-Chain Defense)

Ini pola paling penting di repo ini — terlihat jelas di `.github/scripts/autofix-push-and-report.sh`:

> *"The stage step reads it from the trusted-base checkout, before any branch code has run, and passes the TEXT through step output; 'Push and report' runs those bytes."*

**Masalah yang diselesaikan:** Dalam workflow yang dipicu PR dari fork, script shell bisa diubah oleh PR author. Jika workflow menjalankan `bash ./scripts/foo.sh` dari branch, PR author bisa mengeksekusi arbitrary code dengan kredensial PAT.

**Solusi:** Script dibaca dari base checkout (commit yang trusted), lalu di-pass sebagai *teks* melalui step output. Step berikutnya (yang memegang PAT) hanya menjalankan bytes dari base — tidak ada window waktu di mana branch code dieksekusi.

**Aturan turunan:** *"Keep it that way: `bash <path>` here would hand the PAT-bearing step to whatever the branch left at that path."*

Ini adalah teknik yang bisa diadopsi di repo mana pun yang menjalankan agent AI dengan token GitHub.

## 2.2 Inflight / Heartbeat Loop dengan PID Lifecycle Validation

Di `.github/scripts/autofix-status-heartbeat.sh`:

- Loop dibuka sebagai `setsid` + `&` (detached).
- Setiap

---
### Struktur Berkas Utama
```
📄 .dockerignore
📄 .editorconfig
📄 .gitattributes
📄 .gitignore
📁 .husky/
   └─ 📄 pre-commit
📄 .npmrc
📄 .nvmrc
📄 .pnpmfile.mjs
📄 .prettierignore
📄 .prettierrc.json
📁 .qwen/
   └─ 📁 agents
   └─ 📁 e2e-tests
   └─ 📄 review-context.json
   └─ 📁 skills
   └─ 📁 specs
📁 .vscode/
   └─ 📄 extensions.json
   └─ 📄 launch.json
   └─ 📄 settings.json
   └─ 📄 tasks.json
📄 .yamllint.yml
📄 AGENTS.md
📄 CHANGELOG.md
📄 CLAUDE.md
📄 CONTRIBUTING.md
📄 Dockerfile
📄 LICENSE
📄 Makefile
📄 README.md
📄 SECURITY.md
📁 docs/
   └─ 📄 _meta.ts
   └─ 📁 assets
```
