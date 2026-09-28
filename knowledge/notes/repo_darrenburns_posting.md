# 📚 Catatan Pengetahuan: darrenburns/posting

- **URL:** https://github.com/darrenburns/posting.git
- **Waktu Dipelajari:** 25/9/2026, 22.25.40
- **Tags:** darrenburns, posting, tui, http-client, textual, pydantic, click, httpx, api-testing, terminal-app, python
- **Ringkasan:** Posting adalah HTTP client modern berbasis TUI (Textual User Interface) yang berjalan di terminal, dirancang sebagai alternatif Postman/Insomnia untuk workflow keyboard-centric dan dapat digunakan lewat SSH. Request disimpan sebagai file YAML lokal sehingga mudah dibaca, di-diff, dan di-version control. Aplikasi ini dibangun di atas Python 3.11+, Textual 6.1.0, Pydantic v2, httpx, dan Click, dengan dukungan impor/ekspor cURL, Postman, dan OpenAPI.

---

# 1. Konsep Utama & Arsitektur

**Posting** adalah aplikasi TUI yang berperan sebagai HTTP client. Berbeda dari Postman/Insomnia yang berbasis Electron/GUI, Posting berjalan sepenuhnya di terminal sehingga:
- Bisa dipakai via SSH di server remote.
- Ringan dan cepat dibuka.
- Keyboard-centric (jump mode, Vim keys, command palette).

**Alur kerja tingkat tinggi:**

```
posting (CLI, via click)
   │
   ├── default command → buat config & collection dir → instantiate Posting(app Textual) → app.run()
   ├── locate command  → cetak path config/collection/themes
   └── import command  → parse OpenAPI/Postman → generate YAML collection
                          │
                          ▼
                   Collection (Pydantic models) ⇄ YAML files on disk
                          │
                          ▼
                   Posting (Textual App)
                   ├── UI widgets (request editor, response viewer, tree, etc.)
                   ├── httpx.AsyncClient untuk eksekusi request
                   ├── Variables/Env resolution (python-dotenv + YAML env)
                   ├── Scripting hooks (Posting class di scripts.py)
                   └── tree-sitter syntax highlighting
```

**Layer arsitektur:**

1. **Presentation (Textual)** — `posting.app.Posting` adalah `App` Textual yang mengelola layar, keybindings, tema, dan widget. Textual dipilih karena mendukung CSS-like styling, rendering modern di terminal, dan komposisi widget.
2. **Domain (Pydantic)** — `posting.collection` mendefinisikan semua entitas request: `RequestModel`, `Auth`, `Cookie`, `Header`, `QueryParam`, `RequestBody`, `FormItem`, `Options`, `Scripts`. Ini adalah *single source of truth* untuk struktur data.
3. **Persistence (YAML)** — Collection disimpan sebagai file `.yaml` (satu request = satu file, biasanya) sehingga human-readable dan VCS-friendly. Format YAML dipilih alih-alih JSON karena mendukung komentar dan lebih enak dibaca.
4. **Transport (httpx)** — Eksekusi HTTP memakai `httpx[brotli]==0.28.1`. Versi di-pin karena kode memonkeypatch `httpx._main`.
5. **Configuration (XDG + pydantic-settings)** — Config default di XDG dirs (`xdg-base-dirs` + `pydantic-settings`), dengan `python-dotenv` untuk env file.
6. **CLI (Click + DefaultGroup)** — Entry point di `posting.__main__:cli`.

**Struktur direktori repo yang relevan:**
- `src/posting/` — kode utama.
- `tests/__snapshots__/` — snapshot test dari pytest-textual-snapshot, membandingkan render TUI.
- `tests/sample-collections/`, `sample-configs/`, `sample-envs/` — fixture untuk test.
- `docs/` — dokumentasi MkDocs Material yang di-host di posting.sh.

# 2. Pola Desain & Teknik Coding Kunci

### 2.1 Monkeypatch `httpx._main` untuk Mempercepat Startup

Di `src/posting/__init__.py`:

```python
# This is a hack to prevent httpx from importing _main.py
import sys
sys.modules['httpx._main'] = None
```

**Kenapa ini penting?** httpx punya modul CLI (`httpx._main`) yang memuat `click` + argparse berat, padahal aplikasi Posting hanya memakai `httpx.AsyncClient`. Dengan meng-*set* `sys.modules['httpx._main'] = None`, saat httpx melakukan `from httpx import _main` (via lazy import di `httpx/__init__.py`), Python tidak akan benar-benar memuat modul tersebut. Efeknya: startup time TUI lebih cepat. Karena sifat hack ini, dependency httpx di-pin ke `==0.28.1` (lihat komentar di `pyproject.toml`).

### 2.2 Early `START_TIME` untuk Profiling

```python
# src/posting/_start_time.py
import time
START_TIME = time.perf_counter_ns()
```

Di-import paling awal di `__init__.py`:
```python
from posting._start_time import START_TIME  # noqa: F401
```

Ini memungkinkan kode lain (misalnya splash screen atau telemetry lokal) mengukur delta waktu cold-start secara presisi — pola umum di aplikasi CLI/TUI yang peduli akan latency. Menggunakan `perf_counter_ns()` (bukan `time.time()`) karena tipe clock ini monotonik dan resolusi tinggi.

### 2.3 `DefaultGroup` dari click-default-group

```python
@click.group(cls=DefaultGroup, default="default", default_if_no_args=True)
def cli() -> None:
    """A TUI for testing HTTP APIs."""
```

Pola ini membuat `posting` (tanpa argumen) berperilaku seperti menjalankan `posting default`. Keuntungan: user bisa langsung `posting` untuk membuka TUI, tapi tetap punya `posting import ...` dan `posting locate ...` untuk subcommand lain. `click-default-group` adalah library kecil yang patut diingat ketika mendesain CLI dengan "sensible default".

### 2.4 Lazy Import untuk Subcommand Berat

```python
@cli.command(name="import")
...
def import_spec(spec_path: str, output: str | None, type: str) -> None:
    ...
    # We defer this import as it takes 64ms on an M4 MacBook Pro,
    # and is only needed for a single CLI command - not for the main TUI.
    from posting.importing.open_api import import_openapi_spec
```

Ini pola *deferred import* yang penting: jangan import modul berat di top-level jika hanya dipakai satu

---
### Struktur Berkas Utama
```
📁 .codex/
   └─ 📁 environments
📄 .coverage
📄 .gitignore
📄 .python-version
📄 CONTRIBUTING.md
📄 LICENSE
📄 Makefile
📄 NOTICE
📄 README.md
📁 docs/
   └─ 📄 CHANGELOG.md
   └─ 📄 CNAME
   └─ 📁 assets
   └─ 📄 faq.md
   └─ 📁 guide
   └─ 📄 home-image.afdesign
   └─ 📄 index.md
   └─ 📁 overrides
📄 mkdocs.yml
📄 pyproject.toml
📁 src/
   └─ 📁 posting
📁 tests/
   └─ 📁 __snapshots__
   └─ 📄 posting_snapshot_app.py
   └─ 📁 resources
   └─ 📁 sample-collections
   └─ 📁 sample-configs
   └─ 📁 sample-envs
   └─ 📁 sample-importable-collections
   └─ 📁 sample-themes
📄 uv.lock
```
