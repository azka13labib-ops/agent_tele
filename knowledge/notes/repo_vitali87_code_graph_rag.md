# 📚 Catatan Pengetahuan: vitali87/code-graph-rag

- **URL:** https://github.com/vitali87/code-graph-rag.git
- **Waktu Dipelajari:** 28/9/2026, 01.11.29
- **Tags:** vitali87, code-graph-rag, rag, knowledge-graph, tree-sitter, memgraph, mcp, monorepo, code-analysis, pydantic-ai, deeplearning, architecture
- **Ringkasan:** Code-Graph-RAG adalah sistem RAG (Retrieval-Augmented Generation) untuk monorepo multi-bahasa yang mem-parse setiap file sumber dengan Tree-sitter, membangun knowledge graph terpadu di Memgraph, lalu memungkinkan pengguna melakukan query, memahami, mengedit, dan mengoptimalkan kode dalam bahasa alami. Sistem ini menggabungkan agent LLM (pydantic-ai), pencarian semantik, MCP server, dan patch berbasis AST dengan diff preview sebelum perubahan diterapkan.

---

# 1. Konsep Utama & Arsitektur

**Tujuan Sistem**
Code-Graph-RAG mengubah repositori kode menjadi *knowledge graph* yang dapat ditanya dan diedit. Alih-alih chunking teks biasa (seperti RAG dokumen), sistem mengekstrak entitas struktur kode (fungsi, kelas, method, modul, import, pemanggilan) dengan parser AST/compiler-grade, lalu menyimpannya sebagai graph relasional di Memgraph. Hal ini memungkinkan retrieval yang *grounded* pada struktur kode nyata, bukan sekadar embedding teks.

**Alur Kerja End-to-End**
1. **Ingestion / Parsing**: `codebase_rag` menelusuri file dengan `pathspec` (menghormati `.gitignore`), mem-parse dengan `tree-sitter` (per bahasa: Python, C, C++, JavaScript, TypeScript, Rust, Go, Java, dll — melalui `tree-sitter-<lang>` packages), dan mengekstrak simbol + relasi. Parser alternatif/penyempurna ("compiler-grade frontends") dipakai bila tersedia untuk akurasi.
2. **Graph Construction**: Simbol dan relasi ditulis ke Memgraph melalui `pymgclient` (driver Bolt). Skema graph unifies entitas dari bahasa berbeda — misalnya modul, kelas, fungsi sebagai node, dan `CALLS`, `IMPORTS`, `DEFINES`, `CONTAINS_SECTION`, `INHERITS` sebagai edge.
3. **Agent Layer**: `pydantic-ai` menyusun agent yang menerima pertanyaan NL, memilih tool (search, fetch source, edit), dan menghasilkan Cypher query untuk dieksekusi. Agent yang sama dapat memproduksi *patch* AST-based.
4. **Editing Layer**: Edit dilakukan sebagai patch pada AST (bukan regex/teks), menghasilkan diff via `diff-match-patch`, dipratinjau, lalu diterapkan. Ini menjamin perubahan yang *syntactically valid* untuk bahasa target.
5. **Watch & Re-index**: `watchdog` memantau perubahan file, memicu incremental update graph.
6. **Interfaces**: CLI (`cgr` / `code-graph-rag` via Typer + Rich + prompt-toolkit), MCP server, dan binary standalone (PyInstaller).

**Skema Graph Terpadu (Unified Schema)**
Kunci desain untuk monorepo multi-bahasa: satu skema node/edge yang cukup umum untuk semua bahasa (module, class, function, method, parameter, variable) tetapi dengan label bahasa untuk disambiguasi. Ini memungkinkan query lintas bahasa, misalnya "function mana di repo yang memanggil fungsi Python dari Rust FFI?".

**Incremental Update & Caching**
Untuk monorepo besar, membangun ulang graph dari nol tidak praktis. Karena itu ada:
- `BoundedASTCache` (OrderedDict LRU) — menyimpan AST hasil parse per file agar re-index cepat saat hanya sebagian file berubah.
- Embedding cache — menyimpan hasil embedding untuk simbol/fungsi yang tidak berubah.
- AST cache benchmark (`bench_ast_cache.py`) mengukur biaya insert, lookup, access+LRU, eviction, dan `getsizeof` scan untuk menetapkan batasan cache.

**Fuzzing & Robustness**
`.clusterfuzzlite/` + `fuzz/` berisi harness Atheris (OSS-Fuzz Lite). Target meliputi `fuzz_parse_source` dan `fuzz_incremental_update`. Parser yang menangani input kode arbitrer harus tahan terhadap input jahat/rusak — inilah alasan fuzzing diintegrasikan sebagai bagian dari pipeline CI.

**Distribusi Multi-Channel**
- PyPI wheel (`pyproject.toml`, extras `treesitter-full` untuk semua grammar).
- Binary standalone via `build_binary.py` (PyInstaller `--onefile`, bundling grammar `tree_sitter_*` sebagai `--hidden-import` dan `--collect-all`).
- Docker image (Dockerfile + `.dockerignore`).

# 2. Pola Desain & Teknik Coding Kunci

**1. LRU Cache dengan `OrderedDict`**
`bench_ast_cache.py` menunjukkan pola klasik: cache dengan kapasitas terbatas menggunakan `OrderedDict`, eviction LIFO via `popitem(last=False)`, dan akses LRU via `move_to_end(key)`. Pola ini menghindari dependensi `functools.lru_cache` yang tidak fleksibel untuk key berupa `Path` + grammar variant.

**2. Benchmarking yang Dapat Di-reproduksi**
`benchmarks/harness.py` menyediakan `run_benchmark(name, func, *args, warmup_runs, bench_runs)` dan `print_results`. Semua benchmark (AST cache, embedding cache, drop-in replacements) memanggil harness ini agar perbandingan adil (warmup dijalankan terpisah dari run utama).

**3. "Drop-in Replacements" Pattern**
`bench_dropin_replacements.py` — pola membandingkan implementasi alternatif (mis. `pathspec` vs glob manual, `defusedxml` vs `xml.etree`) sebagai *drop-in replacement* di jalur hot, dengan keputusan berbasis bukti benchmark, bukan asumsi.

**4. Konfigurasi Tersentralisasi sebagai Konstanta**
`codebase_rag.constants` menyimpan semua string literal, key TOML, nama package PyInstaller, dan pattern. Kode seperti `build_binary.py` membaca `cs.PYPROJECT_PATH`, `cs.PYINSTALLER_ARG_*`, `cs.FORBIDDEN_BUNDLE_ENTRY_PATTERNS`. Ini adalah varian *parameter object / configuration object* untuk menghindari magic string.

**5. Parsing TOML Defensif**
`_get_treesitter_packages()` di `build_binary.py` mengekstraksi nama package dari extras `[project.optional-dependencies]` dengan memotong pada delimiter versi (`>=`, `==`, `<`). Versi tidak dipedulikan; hanya nama package. Pola ini menurunkan risiko drift saat dependensi di-bump.

**6. AST-based Surgical Patching**
Alih-alih regex-substitution, edit diimplementasikan sebagai transformasi AST yang menghasilkan diff (menggunakan `diff-match-patch`). Ini memastikan:
- Patch tidak merusak sintaks.
- Diff bisa ditampilkan ke user sebelum commit (human-in-the-loop).
- Konflik dapat dideteksi dengan membandingkan AST, bukan te

---
### Struktur Berkas Utama
```
📁 .clusterfuzzlite/
   └─ 📄 Dockerfile
   └─ 📄 build.sh
   └─ 📄 project.yaml
📄 .coderabbit.yaml
📄 .dockerignore
📄 .env.example
📄 .gitattributes
📄 .gitignore
📄 .gitmodules
📄 .pre-commit-config.yaml
📄 .python-version
📁 .vscode/
   └─ 📄 settings.json
📄 CONTRIBUTING.md
📄 Dockerfile
📄 GOVERNANCE.md
📄 LICENSE
📄 Makefile
📄 NEWS.md
📄 PYPI_README.md
📄 README.md
📁 assets/
   └─ 📄 demo.gif
   └─ 📄 logo-dark-any.png
   └─ 📄 logo-light-any.png
📁 benchmarks/
   └─ 📄 bench_ast_cache.py
   └─ 📄 bench_dropin_replacements.py
   └─ 📄 bench_embedding_cache.py
   └─ 📄 bench_file_hashing.py
   └─ 📄 bench_find_ending_with_fix.py
   └─ 📄 bench_graph_loader.py
   └─ 📄 bench_indexing.py
   └─ 📄 bench_json_serialization.py
```
