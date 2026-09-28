# 📚 Catatan Pengetahuan: sickn33/agentic-awesome-skills

- **URL:** https://github.com/sickn33/agentic-awesome-skills.git
- **Waktu Dipelajari:** 28/9/2026, 07.19.53
- **Tags:** sickn33, agentic-awesome-skills, agent-skills, skill.md, mcp, control-plane, plugin-marketplace, agentic-bundles, local-first, cli, workbench, llm-tooling
- **Ringkasan:** AAS Core adalah control plane lokal "agent-first" untuk katalog 2.476+ playbook `SKILL.md` yang dapat ditemukan, dipilih oleh agen, divalidasi terhadap stack, dan direncanakan sebelum di-apply. Repositori ini membungkus katalog besar itu dengan CLI, MCP lokal, Workbench browser-local, dan manifest plugin untuk Claude Code/Cursor/Codex/Gemini CLI, sehingga agen dapat mengurasi skill-nya sendiri tanpa peringkat atau rekomendasi dari pihak luar.

---

# 1. Konsep Utama & Arsitektur

AAS (Agentic Awesome Skills) bukan sekadar repo kumpulan prompt — ia adalah **control plane lokal** yang memisahkan tiga hal yang biasanya tercampur dalam tooling agent: (a) **katalog** (data), (b) **kebijakan seleksi** (dilakukan oleh agen, bukan oleh server), dan (c) **lifecycle aplikasi perubahan** (validate → plan → preview → apply).

## 1.1 Tiga Lapisan Utama

**Lapisan Katalog (`data/aas-v1/`, `CATALOG.md`, `tools/scripts/generate_index.py`)**
Berisi 2.476+ entri skill. Setiap skill adalah direktori berisi `SKILL.md` dengan frontmatter (nama, deskripsi, trigger, references). Index dibangun ulang oleh `generate_index.py` dan disahkan melalui script validasi. `CATALOG.md` menjadi "sumber manusia", sedangkan index JSON lokal menjadi sumber mesin.

**Lapisan Distribusi (`plugins/`, `.claude-plugin/`, `.agents/plugins/`)**
Katalog di-*slice* menjadi beberapa distribusi:
- `agentic-awesome-skills` / `agentic-awesome-skills-claude`: subset "plugin-safe" (2.414 skill) yang lolos uji kompatibilitas Claude Code.
- `agentic-bundle-*`: **editorial bundles** — bundel kurasi per persona (Essentials, Security Engineer, Security Developer, Web Wizard, Web Designer, Full Stack, Agent Architect, LLM Developer, Indie Game Dev, Python Pro, ...).
- Plugin-safe subset dipisahkan karena Claude Code punya constraint (mis. tidak boleh ada tool yang bertabrakan, frontmatter khusus). Pemisahan ini dikontrol `plugin_compatibility.py --check`.

**Lapisan Kontrol (`AAS Core`, CLI, MCP lokal, Workbench)**
Core adalah entrypoint untuk empat aksi: `catalog discovery`, `agent-owned selection`, `stack validation`, `plan preview`. Apply + recovery ditandai **experimental** (lihat README: "Apply and recovery remain experimental"). MCP lokal membuat agen (Codex/Claude/Cursor) dapat memanggil operasi ini sebagai tools, bukan sekadar baca file.

## 1.2 Alur Kerja Agent-First

1. **Discover** — agen memanggil operasi katalog (via CLI atau MCP) untuk memindai seluruh skill lokal; tidak ada server pusat yang menyaring.
2. **Select** — agen memilih skill yang cocok berdasarkan kebutuhannya; Core **tidak memberi ranking atau rekomendasi** (prinsip desain inti: keputusan arsitektural tetap di agen).
3. **Validate** — Core memeriksa apakah skill yang dipilih cocok dengan stack target (versi Node/Python, dependency, konflik antar-skill).
4. **Plan** — Core menghasilkan rencana (plan) yang dapat di-*preview* sebelum menyentuh filesystem target.
5. **Apply** — **experimental**; ada boundary kepercayaan eksplisit di `docs/users/aas-core.md` pada tiap release tag.

## 1.3 Prinsip "Agent-First, Bukan Agent-Recommended"

Kerangka berpikir ini penting: banyak tool serupa (mis. registry skill) memberi skor relevansi. AAS justru menghapus lapisan itu — agen adalah kurator. Ini memindahkan kompleksitas dari server ke prompt agent + skill directory, mengurangi risiko "salah rekomendasi" dan membuat sistem auditable (agen bisa menjelaskan pilihannya).

## 1.4 Compatibility Bridge

Lapisan `run-python.js` penting: semua tooling berat ditulis Python, tapi dieksekusi melalui Node supaya `package.json` dapat mengekspos script npm seragam (`npm run validate`, `npm run audit:skills`, `npm run bundles:sync`). Ini menyembunyikan dual-runtime dari kontributor.

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 "Single Source, Many Manifest" (Multi-Editor Distribution Pattern)
Katalog tunggal di `data/aas-v1/` diproyeksikan ke banyak manifest: `.agents/plugins/marketplace.json` (untuk editor generik), `.claude-plugin/marketplace.json` (Claude Code), `plugin.json` (metadata plugin), dan `plugins/*` (source aktual). Sinkronisasi dijaga script `sync_repo_metadata.py` + `sync_editorial_bundles.py`. Pola ini memungkinkan *satu repo* memasok banyak ekosistem tanpa fork.

## 2.2 Editorial Bundles sebagai Kurasi Berlapis
Alih-alih memaksa pengguna memilih 2.400+ skill, bundel editorial memetakan persona → subset skill. Ini pola "persona bundle" yang umum di marketplace modern; di sini diimplementasikan sebagai folder plugin terpisah dengan policy `installation: AVAILABLE` dan `authentication: ON_INSTALL`.

## 2.3 Strict vs Non-Strict Validation Mode
`validate` vs `validate:strict`, `audit:skills` vs `audit:skills:strict`. Mode non-strict berguna untuk PR awal (warn only), strict untuk rilis. Ini pola umum "graduated CI gate" yang dipakai untuk mengelola 2.400+ file tanpa memblokir kontribusi komunitas.

## 2.4 Idempotent Repair Scripts (`fix:*`)
Ada banyak `fix:missing-sections`, `fix:missing-metadata`, `fix:truncated-descriptions`, `cleanup:synthetic-sections`. Ini pola **self-healing catalog**: katalog besar bisa "membusuk" seiring waktu (frontmatter hilang, deskripsi terpotong saat migrasi), dan tooling meny

---
### Struktur Berkas Utama
```
📁 .agents/
   └─ 📁 plugins
📁 .claude-plugin/
   └─ 📄 marketplace.json
   └─ 📄 plugin.json
📄 .env.local.example
📄 .gitignore
📄 .snyk
📄 AGENTS.md
📄 CATALOG.md
📄 CHANGELOG.md
📄 CODE_OF_CONDUCT.md
📄 CONTRIBUTING.md
📄 LICENSE
📄 LICENSE-CONTENT
📄 PRIVACY.md
📄 README.md
📄 SECURITY.md
📄 START_APP.bat
📄 TERMS.md
📁 apps/
   └─ 📁 web-app
📁 assets/
   └─ 📄 aas-logo.jpeg
   └─ 📄 aas-readme-hero.jpeg
   └─ 📄 aas-social-card.jpeg
   └─ 📄 buy-me-a-coffee-banner.png
   └─ 📄 github-social-preview.png
📁 data/
   └─ 📁 aas-v1
   └─ 📄 aliases.json
   └─ 📄 bundles.json
   └─ 📄 catalog.json
   └─ 📄 category-overrides.json
   └─ 📄 editorial-bundles.json
```
