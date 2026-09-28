# 📚 Catatan Pengetahuan: repowise-dev/repowise

- **URL:** https://github.com/repowise-dev/repowise.git
- **Waktu Dipelajari:** 28/9/2026, 13.31.07
- **Tags:** repowise-dev, repowise, codebase-intelligence, mcp, code-health, static-analysis, dependency-graph, git-analytics, dead-code-detection, architectural-decisions, ai-agents
- **Ringkasan:** Repowise adalah tool codebase intelligence self-hosted yang mengindeks kode, dependency graph, riwayat git, tes, dokumentasi, dan keputusan arsitektur menjadi satu local index yang selalu update. Index tersebut disajikan ke developer dan AI agent melalui MCP, menghasilkan jawaban bersitasi, analisis dampak perubahan, skor code health, dan deteksi dead code — semuanya tanpa panggilan LLM untuk analisis inti.

---

# 1. Konsep Utama & Arsitektur

Repowise dibangun di atas premis bahwa setiap AI agent yang bekerja pada sebuah codebase saat ini "membayar" biaya token untuk menemukan ulang struktur kode setiap kali konteks direset. Solusinya adalah **mengindeks codebase sekali secara mendalam**, lalu menyajikan hasilnya sebagai konteks terkurasi ke agent dan developer.

## 1.1 Enam Sumber Data yang Diindeks

Dari README dan judul produk, index dibangun dari enam lapis informasi:

1. **Source code** — AST per bahasa, simbol, dan struktur.
2. **Dependency graph** — edge antar modul/file/fungsi (statis, compiler-graded).
3. **Git history** — analytics commit, churn, hotspot, ownership.
4. **Tests & contracts** — apa yang diuji, apa kontrak antar komponen.
5. **Documentation** — doc existing + auto-generated docs yang selalu sinkron.
6. **Architectural decisions (ADR)** — keputusan desain yang tersimpan sebagai artefak pertama-kelas.

Index ini **persisten dan terus diperbarui** (continuously updated local index), bukan snapshot satu kali.

## 1.2 Tiga Permukaan Konsumsi

```
                 ┌──────────────────────────────┐
                 │   Local Persistent Index     │
                 │  (code, graph, git, tests,   │
                 │   docs, decisions)           │
                 └──────────────┬───────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
  Understand code         Change safely          Improve continuously
  - Ask cited Q&A         - Change impact        - Code health scores
  - Architecture view     - PR review            - Dead code detection
  - Execution flows       - Risk scoring         - Concrete fixes
  - Live docs             - Blast radius         - Refactor targets
```

Permukaan ini diekspos ke **editor, pull request, dashboard, dan multi-repo workspace** — dengan MCP sebagai protokol tunggal yang dipakai agent.

## 1.3 Alur Kerja End-to-End

1. **Ingest & parse** — Repowise meng-clone/melokalisasi repo, mem-parse AST, membangun graf modul & simbol.
2. **Enrich dengan git** — melampirkan churn/ownership/co-change ke setiap node graf.
3. **Cross-link** — menghubungkan tes ke kode yang diuji, doc ke simbol, ADR ke modul terkait.
4. **Persist** ke local index (kemungkinan SQLite/embedded store, mengingat "self-hosted" & "no API key").
5. **Serve via MCP** — agent memanggil tool seperti `ask_codebase`, `impact_of_change`, `health_of`, `dead_code`, `decisions_for`.
6. **Update inkremental** — setiap commit memicu re-index parsial sehingga index selalu "current by construction".

## 1.4 Klaim Arsitektural Kunci: Zero-LLM Core

Ini pembeda paling penting dari pesaing seperti Coveo/Emergent/embedding-only tools. Menurut README:

> "Zero LLM calls for graph, risk, health, tests, dead code, and PR review. Generated prose is optional."

Artinya:
- **Deterministik** — hasil sama untuk input sama; bisa diuji.
- **Gratis secara marginal** — biaya token agent turun karena jawaban sudah disiapkan (393 vs 13.984 token).
- **Auditable** — tiap klaim punya sitasi ke simbol/baris/commit (evidence-backed).
- **LLM hanya untuk prosa** — auto-generated docs narration bersifat opsional dan bisa dimatikan.

---

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 "Evidence-Backed Answer" Pattern

Setiap jawaban yang diberikan ke agent bukan sekadar teks bebas, melainkan **record terstruktur dengan sitasi**. Pola ini mirip RAG tetapi dengan **retrieval deterministik dari graf** alih-alih similarity search vektor:

```
Question → Symbol/File Resolution → Graph Traversal → Evidence Bundle
                                                        ├─ file:line refs
                                                        ├─ commit SHA refs
                                                        ├─ ADR-ID refs
                                                        └─ confidence score
```

Keuntungan: agent bisa "click-through" untuk verifikasi, dan hallucination ditekan karena setiap klaim punya anchor.

## 2.2 "Compiler-Graded Graph Accuracy"

Benchmark menyebut **"7 compiler-graded cells"** dan **"37,853 oracle edges"**. Ini pola evaluasi cerdas: alih-alih membandingkan dengan ground-truth manual (mahal), Repowise memanfaatkan **compiler/type-checker sebagai oracle** untuk edge dependency. Edge yang salah akan membuat kompilasi gagal — memberi sinyal kebenaran yang objektif.

## 2.3 Multi-Repo Workspace (Federated Index)

Pola "past one repo" pada README menunjukkan arsitektur **federasi**: index per repo independen, tapi bisa di-query bersama untuk monorepo-of-monorepos. Ini berarti:
- Isolasi kegagalan (satu repo gagal parse tidak merusak yang lain).
- Query lintas repo dengan resolusi simbol yang tetap deterministik.

## 2.4 Token-Budget-Aware Retrieval

Angka **97.2% context payload lebih kecil** menunjukkan retrieval dirancang dengan **budget token sebagai constraint**, bukan afterthought. Pola ini umum disebut "context compression" atau "semantic packing":

- Ambil hanya simbol yang relevan (bukan seluruh file).
- Sertakan skeleton + sitasi, bukan isi penuh.
- Manfaatkan graf untuk "rank" relevansi sebelum serialisasi.

## 2.5 Hotspot & Churn Scoring untuk Code Health

Code health score kemungkinan mengombinasikan:
- **Cyclomatic/complexity** per fungsi (statik).
- **Churn** (frekuensi perubahan dari git).
- **Co-change coupling** (file yang selalu diubah bersama).
- **Test coverage & test-to-code ratio**.
- **Dead code penalty**.

Kombinasi ini dibobot jadi skor tunggal per file/modul, mirip pendekatan CodeScene tetapi deterministik tanpa ML.

## 2.6 Dead Code Detection Deterministik

Untuk mendeteksi dead code tanpa LLM, teknik yang lazim:
1. Bangun **reachability graph** dari entry points (main, exported symbols, test discovers).
2. Tandai simbol yang tidak pernah direachable sebagai kandidat.
3. Cross-check dengan

---
### Struktur Berkas Utama
```
📁 repowise-dev/repowise (via GitHub API)
```
