# 📚 Catatan Pengetahuan: astral-sh/uv

- **URL:** https://github.com/astral-sh/uv.git
- **Waktu Dipelajari:** 27/9/2026, 23.08.39
- **Tags:** astral-sh, uv, rust, python-packaging, resolver, pubgrub, pip-alternative, deeplearning
- **Ringkasan:** uv adalah package & project manager Python yang ditulis ulang dari nol dalam Rust oleh Astral (pembuat Ruff), dirancang sebagai drop-in replacement untuk `pip`, `pip-tools`, `virtualenv`, `pipx`, dan sebagian `poetry`. Arsitekturnya menggabungkan resolver versi berbasis SAT (PubGrub), cache global berlapis (hardlink/reflink), serta eksekutor wheel paralel yang membuat instalasi 10–100x lebih cepat daripada pip. Cocok dipakai untuk CI/CD cepat, monorepo Python, dan sebagai fondasi tooling agentic yang butuh manajemen environment deterministik.

---

# 1. Konsep Utama & Arsitektur

uv memiliki tiga pilar arsitektural yang harus dipahami:

### 1.1 Workspace Rust Multi-Crate
Repo `astral-sh/uv` adalah Cargo workspace besar. Crate inti yang penting:

| Crate | Tanggung Jawab |
|---|---|
| `uv` (bin) | Entrypoint CLI tipis, delegasi ke crate lain |
| `uv-cli` | Definisi argumen `clap` untuk seluruh subcommand (`pip`, `venv`, `lock`, `sync`, `run`, `tool`, `python`, `publish`) |
| `uv-resolver` | Implementasi PubGrub resolver, constraint, conflict tree |
| `uv-installer` | Instalasi wheel ke site-packages, kompilasi bytecode, entrypoint script |
| `uv-cache` | Cache content-addressable, deduplikasi wheel/sdist, indexing |
| `uv-distribution` | Download, verifikasi hash, ekstraksi, metadata sdist via PEP 517 build |
| `uv-python` | Discovery interpreter, manajemen build CPython standalone |
| `uv-workspace` | Parsing `pyproject.toml`, workspace member, dependency group (PEP 735) |
| `uv-requirements`, `uv-pep508` | Parser PEP 508 requirement, Marker, Version |

Pemisahan ini memudahkan fuzzing, benchmark, dan pengujian unit pada tiap layer (mis. `uv-resolver` bisa diuji tanpa I/O nyata).

### 1.2 Alur Kerja Resolusi
1. **Discovery**: baca `pyproject.toml`/`requirements.txt`, gabungkan dengan marker environment (OS, Python version, platform tag).
2. **Resolver**: bentuk graph dependensi dengan `PubGrub`. Setiap paket menjadi variabel, versi menjadi domain, dan incompatibility menjadi clause. Saat konflik, resolver melakukan *backjumping* daripada linear backtracking.
3. **Forking universal**: untuk `uv lock --universal`, resolver dapat mem-fork state pada divergensi marker (mis. `sys_platform == "win32"` vs `"linux"`) sehingga satu lockfile menutup banyak environment.
4. **Preference**: uv menggunakan preferensi dari lockfile lama (jika ada) sehingga re-resolve minimal (incremental resolution).
5. **Output**: `uv.lock` berisi paket, versi, source (registry/git/path/url), hash wheel & sdist, dan marker per platform.

### 1.3 Alur Instalasi
- **Fetch metadata**: uv mengambil `.whl` → baca `RECORD`, `METADATA` langsung dari zip (tanpa extract penuh) menggunakan `zip` crate + `memmap`.
- **Sdist**: bila tidak ada wheel, uv menjalankan PEP 517 build backend di environment terisolasi (atau fallback ke `--no-build-isolation`).
- **Instalasi**: hardlink dari cache ke `site-packages`; jika cross-device, fallback ke copy + `reflink` (APFS/XFS/Btrfs).
- **Post-install**: tulis `.pth`, compile `__pycache__` secara paralel (rayon), buat console script entrypoint launcher yang menunjuk interpreter secara absen.

# 2. Pola Desain & Teknik Coding Kunci

- **Content-addressable cache**: setiap artifact dinamai berdasarkan digest (sha256). Dua project berbeda yang butuh `numpy==2.1.0` berbagi entri cache yang sama → disk efisien.
- **Hardlink-first, copy-last**: `uv-installer` mencoba `std::fs::hard_link`, lalu `reflink` (ioctl FICLONE di Linux, `clonefile` di macOS), lalu fallback copy. Menghindari duplikasi byte besar.
- **Resolver sebagai library murni**: `uv-resolver` tidak melakukan I/O; semua data masuk via trait `Provider` (mirip `solver::DependencyProvider` di Cargo). Ini memudahkan pengujian dan paralelisasi.
- **Marker algebra**: uv melakukan penyederhanaan marker (union/intersection) sehingga lockfile tidak meledak eksponensial. Ada utilitas `MarkerTree` untuk merge marker.
- **Fork-by-marker**: alih-alih resolusi terpisah untuk setiap OS, resolver mem-fork pada titik divergensi lalu menggabungkan hasil dengan marker.
- **Async concurrency dengan backpressure**: download via `reqwest` + `tokio::sync::Semaphore` (default ~50 concurrent), ekstraksi paralel via `rayon`, dan cache write memakai `fs-err` + atomic rename.
- **Error UX seperti compiler**: error resolusi ditampilkan dalam bentuk *conflict tree* dengan penyebab berantai (`Because foo requires bar>=2 and baz requires bar<2, ...`).
- **Zero-config detection**: `uv run script.py` mendeteksi PEP 723 header `# /// script` dan otomatis membuat venv ephemeral + install dependensi inline.
- **PEP 723 + `uvx` (alias `uv tool run`)**: menjalankan CLI Python sekali pakai tanpa mencemari environment global.
- **`--python-preference` & managed Python**: uv punya strategi urutan untuk memilih interpreter (managed vs system vs virtualenv) yang bisa dikonfigurasi.
- **Self-update & instalasi statis**: binary tunggal (musl di Linux) tanpa runtime Python → startup ~10ms.

# 3. Cuplikan Kode Kunci & Cara Kerja Fungsi

### 3.1 Publik API: `uv` CLI

```bash
# Membuat project baru (pyproject.toml + uv.lock)
uv init myproj && cd myproj

# Menambah dependensi & auto-sync
uv add requests "flask>=3.0"

# Menjalankan kode tanpa mengelola venv manual
uv run python -c "import requests; print(requests.__version__)"

# Menjalankan tool sekali pakai (pengganti pipx)
uvx ruff check .

# Menginstal Python versi spesifik
uv python install 3.12 && uv python pin 3.12

# Resolusi universal untuk CI multi-OS
uv lock --universal
uv sync --frozen --all-extras --group dev
```

### 3.2 Pola resolver (`uv-resolver`) — pola pseudocode

Provider trait yang dipakai resolver (disusun dari struktur repo):

```rust
// Abstraksi: sumber data dependensi untuk PubGrub
#[async_trait]
pub trait DependencyProvider {
    type P: Package;
    type V: Version;

    /// Versi apa saja yang boleh dipilih untuk paket ini?
    fn choose_version(&self, package: &Self::P, range: &Range<Self::V>)
        -> Result<Option<Self

---
### Struktur Berkas Utama
```
📁 astral-sh/uv (via GitHub API)
```
