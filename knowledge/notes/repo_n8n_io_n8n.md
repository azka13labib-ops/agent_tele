# 📚 Catatan Pengetahuan: n8n-io/n8n

- **URL:** https://github.com/n8n-io/n8n.git
- **Waktu Dipelajari:** 28/9/2026, 08.20.58
- **Tags:** n8n-io, n8n, workflow-automation, fair-code, ai-agents, langchain, monorepo, nodejs, turborepo, self-hosted, visual-programming, low-code
- **Ringkasan:** n8n adalah platform automation workflow fair-code yang menggabungkan visual canvas building dengan kode kustom (JavaScript/Python), memiliki kemampuan AI-native melalui integrasi LangChain, 1500+ integrasi bawaan, dan dapat di-deploy self-hosted maupun cloud. Repositori ini adalah monorepo TypeScript/Node.js berskala besar (v2.41.0) yang mengelola editor UI, engine eksekusi workflow, node integrations, dan paket-paket internal via pnpm workspaces + Turborepo.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Identitas & Filosofi
n8n ("nodemation") adalah platform automation *fair-code* — source-available namun dengan lisensi Sustainable Use + Enterprise. Positioning 2024–2025 berubah dari sekadar "workflow automation" menjadi **"The Platform for AI Agents and Workflow Automation"** — menjadikan AI agent sebagai first-class citizen dari sebuah automation engine.

## 1.2 Struktur Monorepo
Repo ini adalah monorepo besar berbasis **pnpm 12.4.2** dengan **Node ≥ 24** dan **Turborepo** sebagai task orchestrator. Struktur de-facto (dari package.json + referensi repo):

```
n8n/
├── packages/
│   ├── cli/                          # package "n8n" — CLI + server runtime
│   ├── core/                         # n8n-core — workflow engine inti
│   ├── workflow/                     # @n8n/workflow — domain model workflow
│   ├── nodes-base/                   # node-node built-in tanpa AI
│   ├── @n8n/nodes-langchain/         # node AI (LangChain integration)
│   ├── editor-ui/                    # frontend Vue 3 (n8n-editor-ui)
│   ├── @n8n/design-system/           # komponen UI reusable
│   ├── @n8n/ai-workflow-builder.ee/  # AI workflow generator (enterprise)
│   ├── @n8n/json-schema-to-zod/      # util konversi JSON Schema ↔ Zod
│   ├── @n8n/tournament/              # expr evaluator aman
│   └── ... (puluhan paket lain)
├── scripts/                          # build & rilis
│   ├── build-n8n.mjs                 # bundling produksi
│   ├── dockerize-n8n.mjs             # build image Docker
│   └── ...
├── .claude/plugins/n8n/              # Claude Code plugin untuk dev n8n
├── .agents/skills                    # skill untuk AI agents
└── .opencode/skills                  # skill OpenCode agents
```

## 1.3 Layer Runtime
- **Core engine** (`n8n-core` + `packages/workflow`): eksekusi DAG node, ekspresi `{{ }}`, kredensial, webhook, queue mode.
- **CLI/server** (`packages/cli`, package `n8n`): HTTP server (Express + NestJS-style DI), REST API, worker, queue.
- **Editor UI** (`n8n-editor-ui`): Vue 3 + TypeScript, visual canvas (VueFlow), node palette, expression editor.
- **Nodes** (`n8n-nodes-base` + `@n8n/n8n-nodes-langchain`): 400+ node konektor + 1500+ integrasi (sebagian via generic HTTP / community paket).

## 1.4 AI-Native Architecture
Yang membedakan n8n dari Zapier/Make:
1. **LangChain sebagai agent runtime** — node LangChain (`Agent`, `Chain`, `Tool`, `Memory`, `Vector Store`, `Retriever`, `LLM`, `Embeddings`) di-*wrap* menjadi node visual.
2. **Provider abstraction** — user bisa ganti OpenAI ↔ Anthropic ↔ Google ↔ Ollama tanpa ubah workflow topology.
3. **AI Workflow Builder (EE)** — `@n8n/ai-workflow-builder.ee` mengenerate workflow dari deskripsi natural language.
4. **Code when you need it** — node `Code` (JS/Python) dan `Execute Command`; dapat import npm package di self-hosted.

## 1.5 Deployment Mode
- **Self-hosted single-binary** (`docker run docker.n8n.io/n8nio/n8n`) — SQLite default.
- **Queue mode** — Postgres + Redis + multiple workers (untuk skala produksi).
- **Cloud** (app.n8n.cloud) — managed.
- **Enterprise** — RBAC, SSO, audit logs, external secrets, log streaming.

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Catalog Dependency Pattern
pnpm `catalog:` mencegah **duplikasi dependensi** — sangat penting untuk lib runtime seperti `zod`, `@langchain/core`, `form-data`, `langsmith`. Baseline `.code-health-baseline.json` secara eksplisit menandai pelanggaran:
```json
{ "rule": "single-instance-libs",
  "message": "\"@langchain/core\" is a runtime dependency of \"@n8n/n8n-nodes-langchain\"; it must be a peerDependency." }
```
Konsekuensinya: plugin (khususnya LangChain) berbagi **instance tunggal** `@langchain/core` dan `zod`, agar class identity (`instanceof`), registry, dan schema parsing tidak pecah.

## 2.2 Express + DI Container (packages/cli)
n8n memakai `@n8n/di` — decorator-based DI mirip NestJS (`@Service`, `@Container.get(...)`) untuk menghindari import singleton yang bikin circular dependency. Ini memudahkan test (mocking) dan modularitas.

## 2.3 Workflow-as-Data (Immutable Node Interface)
Setiap node adalah class dengan kontrak:
- `description: INodeTypeDescription` — metadata UI (parameter, port, credentials, dll).
- `execute()` — logika runtime.
- `methods.loadOptions`, `webhook`, `poll`, `trigger` — lifecycle opsional.
Node diregistrasi via path `dist/nodes/**/*.node.js` → pnpm paket dapat di-*overlay* sebagai custom node (folder `~/.n8n/custom`).

## 2.4 Expression Engine & Tournament
n8n awalnya memakai `vm2`, lalu bermigrasi ke `@n8n/tournament` — evaluator expression sandbox yang lebih aman untuk `{{ $json.foo + $node["X"].json.bar }}`. Ini pola mengizinkan low-code power tanpa RCE penuh.

## 2.5 Queue Mode & Worker Decoupling
- **Main process**: UI + REST API.
- **Webhook process**: incoming trigger.
- **Workers**: eksekusi berat (dengan concurrency env var).
Semua berbagi Postgres + Redis (Bull queue). Pola *scale-out horizontally* untuk long-running AI calls.

## 2.6 Turborepo Pipeline
Script `build:n8n` = `node scripts/build-n8n.mjs` — bukan langsung `turbo run build`. Alasannya: ada *cross-package bundling* (mis. bundle `node_modules`, generate `dist/` final dari multi-package), plus layer Docker multi-stage. Turborepo dipakai untuk `typecheck`, `test`, `lint` paralel.

## 2.7 AI-Coding-Agent Integration
`.claude/plugins/n8n/`, `.agents/skills`, `.opencode/skills`, dan `.

---
### Struktur Berkas Utama
```
📄 .actrc
📁 .agents/
   └─ 📁 review-rules
   └─ 📁 skills
📄 .aikido
📄 .boundaries-baseline.json
📁 .claude/
   └─ 📄 README.md
   └─ 📁 plugins
   └─ 📄 settings.json
📄 .code-health-baseline.json
📁 .devcontainer/
   └─ 📄 Dockerfile
   └─ 📁 codespaces
   └─ 📄 devcontainer.json
   └─ 📄 docker-compose.yml
   └─ 📁 preview
📄 .dockerignore
📄 .editorconfig
📄 .env.eval.example
📄 .env.local.example
📄 .git-blame-ignore-revs
📄 .gitattributes
📁 .githooks/
   └─ 📄 check-pnpm.sh
📄 .gitignore
📄 .npmignore
📁 .opencode/
   └─ 📁 skills
📄 .poutine.yml
📄 .prettierignore
📄 .prettierrc.js
📄 .tbls.postgres.yml
📄 .tbls.sqlite.yml
📁 .vscode/
```
