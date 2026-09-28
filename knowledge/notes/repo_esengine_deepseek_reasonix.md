# 📚 Catatan Pengetahuan: esengine/DeepSeek-Reasonix

- **URL:** https://github.com/esengine/DeepSeek-Reasonix.git
- **Waktu Dipelajari:** 27/9/2026, 15.57.45
- **Tags:** esengine, DeepSeek-Reasonix
- **Ringkasan:** Reasonix adalah AI coding agent open-source (MIT) berbahasa Go yang dikompilasi menjadi satu binary tunggal, dirancang khusus untuk DeepSeek dan dioptimalkan di sekitar *prefix-cache stability* sehingga aman dibiarkan berjalan lama (long autonomous run). Satu engine lokal diekspos lewat empat antarmuka — terminal (TUI Bubble Tea v2), desktop Studio, browser via WebSocket, dan editor via protokol ACP — dengan plan mode, sistem permission, workspace sandbox, serta checkpoint per-turn yang membuat setiap langkah dapat dibaca ulang dan di-undo.

---

---METADATA---
TITLE: esengine/DeepSeek-Reasonix
TAGS: esengine, DeepSeek-Reasonix, deeplearning, architecture, coding-agent, prefix-cache, go, bubbletea, tree-sitter, acp, context-engineering, agent-sandbox
SUMMARY: Reasonix adalah AI coding agent open-source (MIT) berbahasa Go yang dikompilasi menjadi satu binary tunggal, dirancang khusus untuk DeepSeek dan dioptimalkan di sekitar *prefix-cache stability* sehingga aman dibiarkan berjalan lama (long autonomous run). Satu engine lokal diekspos lewat empat antarmuka — terminal (TUI Bubble Tea v2), desktop Studio, browser via WebSocket, dan editor via protokol ACP — dengan plan mode, sistem permission, workspace sandbox, serta checkpoint per-turn yang membuat setiap langkah dapat dibaca ulang dan di-undo.
KEY_TAKEAWAYS:
- **Prefix-cache stability sebagai constraint arsitektur utama**: seluruh pipeline konteks dirancang agar byte yang dikirim ke model identik antar-turn kecuali benar-benar berubah secara semantik — invalidation palsu (false positive) dianggap sama merugikan dengan perubahan yang terlewat.
- **"Truth is measured, not declared"**: benchmark `catalog-detector` tidak mendeklarasikan perubahan secara manual, melainkan me-render blok proyeksi (apa yang benar-benar dilihat model) sebelum dan sesudah, lalu membandingkan digest-nya sebagai ground truth.
- **Tiga detektor perubahan dengan trade-off biaya/kebenaran eksplisit**: `projection` (walk + read, akurat), `metadata` (path+size+mtime, murah tapi bisa salah), `observed-write

---
### Struktur Berkas Utama
```
📄 .env.example
📄 .gitattributes
📁 .githooks/
   └─ 📄 pre-push
📄 .gitignore
📄 .golangci-version
📄 .golangci.yml
📄 .goreleaser.yaml
📁 .reasonix/
   └─ 📁 commands
📁 .signpath/
   └─ 📁 contracts
📄 AGENTS.md
📄 CLAUDE.md
📄 CONTRIBUTING.md
📄 LICENSE
📄 Makefile
📄 README.md
📄 README.zh-CN.md
📄 REASONIX.md
📄 SECURITY.md
📁 benchmarks/
   └─ 📄 README.md
   └─ 📁 catalog-detector
   └─ 📁 compaction
   └─ 📁 context-maintenance-e2e
   └─ 📁 context-retrieval
   └─ 📁 e2e
   └─ 📁 fanout-width
   └─ 📁 memorybench
📁 cmd/
   └─ 📁 e2ebench
   └─ 📁 extension-protocol-gen
   └─ 📁 reasonix
   └─ 📁 reasonix-plugin-example
```
