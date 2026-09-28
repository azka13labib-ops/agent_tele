# 📚 Catatan Pengetahuan: inferstep/ATLAS

- **URL:** https://github.com/inferstep/ATLAS.git
- **Waktu Dipelajari:** 27/9/2026, 20.03.53
- **Tags:** inferstep, atlas, deeplearning, architecture, coding-agent, test-time-learning, local-llm, gguf, self-hosted, autonomous-specialization, sandboxed-execution, model-agnostic
- **Ringkasan:** ATLAS (Adaptive Test-time Learning and Autonomous Specialization) adalah local coding agent open-source (AGPL-3.0) yang membungkus model bahasa kecil/terbuka dengan lapisan sistem cerdas — planning, candidate generation, quality scoring, sandboxed testing, dan repair — sehingga model GGUF lokal dapat menyelesaikan pekerjaan rekayasa perangkat lunak nyata tanpa API berbayar atau dependensi cloud.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Filosofi Inti
ATLAS bukan model baru, melainkan **harness/orchestrator agent** yang menempatkan kecerdasan di *sekitar* model. Alih-alih mengandalkan satu generasi tunggal dari LLM (yang rawan halusinasi), ATLAS menerapkan siklus test-time compute yang memaksa model untuk:

1. **Plan** — dekomposisi tugas menjadi langkah-langkah.
2. **Generate** — menghasilkan N kandidat solusi/implementasi.
3. **Score** — menilai kualitas kandidat via heuristik/verifier.
4. **Verify** — menjalankan kandidat di sandbox (compile, unit test, lint).
5. **Repair** — jika gagal, umpan-balik error ke loop dan regenerate.

Kombinasi ini menghasilkan *frontier-style reasoning* pada model berukuran kecil (7B–14B kelas GGUF) dengan biaya lokal.

## 1.2 Pipeline V3 (Alur Kerja)
Pipeline V3 terlihat dari TUI demo (`docs/images/herodemo.gif`) pada skenario *file creation*. Secara konseptual:

```
User Task (TUI / CLI)
        │
        ▼
┌────────────────────────┐
│  Planner               │  → dekomposisi + strategi budget
└──────────┬─────────────┘
           ▼
┌────────────────────────┐
│  Candidate Generator   │  → N variasi via sampling/CoT/temperature
└──────────┬─────────────┘
           ▼
┌────────────────────────┐
│  Quality Scorer        │  → static analysis, ebpf heuristics, model-judge opsional
└──────────┬─────────────┘
           ▼
┌────────────────────────┐        fail
│  Sandboxed Executor    │ ────────────────┐
│  (compile / test)      │                 │
└──────────┬─────────────┘                 ▼
           │ pass                    ┌──────────────┐
           ▼                         │   Repair     │──┐
┌────────────────────────┐           └──────────────┘  │
│  Commit to Workspace   │                              │
└────────────────────────┘        ◄──── loop sampai pass ┘
```

## 1.3 Adaptive Test-time Learning
Atribut "Adaptive" di nama ATLAS merujuk pada **budget komputasi dinamis**: sistem memperkirakan kompleksitas tugas (mis. dari panjang diff, jumlah file terdampak, hasil compile awal) dan mengalokasikan:
- jumlah kandidat,
- kedalaman reasoning,
- jumlah iterasi repair,
- prioritas verifikasi (compile-only vs full test suite).

Untuk tugas trivial (rename variabel), ATLAS memilih jalur *fast-path* satu-shot. Untuk tugas sulit (refactor lintas modul), ATLAS menaikkan jumlah kandidat dan iterasi.

## 1.4 Autonomous Specialization
"Specialization" = ATLAS dapat mempelajari/mempertahankan preferensi proyek (style guide, test framework, layout direktori) di **SQLite state store**, sehingga seiring waktu agent makin cocok dengan codebase tertentu tanpa fine-tuning model.

## 1.5 Runtime & Deployment
- **Model backend**: GGUF via llama.cpp / server lokal (NVIDIA CUDA, AMD ROCm, Apple Metal, Vulkan, CPU fallback).
- **State**: SQLite (single-file, migrasi dari Redis → menghilangkan dependensi server).
- **Update**: staged upgrade + rollback otomatis; manifest artefak ditandatangani untuk mencegah suplai-chain attack.
- **Observability**: structured logging + correlation ID per task/sesi.
- **Isolasi**: sandbox eksekusi dengan flag `ATLAS_SANDBOX_NET_INTERNAL=true` untuk mematikan egress network saat menjalankan kode yang dihasilkan.

---

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 Pattern: Best-of-N dengan Verifier (Test-time Scaling)
Daripada argmax single decode, ATLAS melakukan *rejection sampling* memakai verifier eksternal (compiler/test) — pola klasik untuk menaikkan pass@k dengan model kecil. Implementasi umum: `n_candidates` di-skala oleh estimator kesulitan.

## 2.2 Pattern: Sandboxed Execution dengan Capability Flag
Eksekusi kode model di lingkungan terisolasi (kontainer/nspawn/seccomp) dengan **default-deny** untuk network internal. Flag `ATLAS_SANDBOX_NET_INTERNAL` menunjukkan desain fail-safe: mudah di-hardening tanpa mengubah kode pipeline.

## 2.3 Pattern: Idempotent State Store
Migrasi Redis → SQLite adalah pilihan arsitektural penting: menghilangkan server state eksternal, menyederhanakan deployment self-hosted, dan memberi durability transaksional (WAL). Pola ini berguna untuk agent yang perlu resume sesi panjang.

## 2.4 Pattern: Signed Artifact Manifest + Staged Rollback
Setiap rilis/upgrade divalidasi oleh manifest bertanda tangan; jika health-check pasca-upgrade gagal, sistem auto-restore ke versi sebelumnya. Ini pola *canary deployment* yang diadopsi ke dalam aplikasi desktop/CLI — jarang pada proyek agent lokal.

## 2.5 Pattern: Model-agnostic Adapter
Lapisan inference mengabstraksi backend (llama.cpp, Ollama-compatible, dsb.) sehingga strategi planning/scoring tetap sama terlepas dari model. Memudahkan swap GGUF tanpa mengubah pipeline.

## 2.6 Pattern: Correlation IDs untuk Observability
Setiap langkah dalam pipeline V3 (plan, gen, score, exec, repair

---
### Struktur Berkas Utama
```
📁 inferstep/ATLAS (via GitHub API)
```
