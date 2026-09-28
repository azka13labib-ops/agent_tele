# 📚 Catatan Pengetahuan: tensorchord/envd

- **URL:** https://github.com/tensorchord/envd.git
- **Waktu Dipelajari:** 27/9/2026, 12.54.38
- **Tags:** tensorchord, envd, development-environment, buildkit, starlark, oci, ai-ml, reproducible-environment, golang, kubernetes
- **Ringkasan:** envd adalah CLI berbasis Go yang membangun development environment container untuk AI/ML dari deklarasi Starlark (`build.envd`). Repositori ini menggabungkan BuildKit sebagai build engine, SSH-based access (envd-sshd), dan abstraksi context (local Docker / Kubernetes cluster) untuk menghasilkan environment reproducible yang OCI-compatible dan bisa di-cache secara remote.

---

# 1. Konsep Utama & Arsitektur

## 1.1 Gambaran Tingkat Tinggi
`envd` menyelesaikan masalah klasik AI/ML dev: lingkungan yang kompleks (Python, CUDA, BASH scripts, Dockerfiles) mudah sekali pecah. Solusinya: satu file deklaratif `build.envd` + satu perintah `envd up`.

Komponen utama:

| Komponen | Bahasa | Peran |
|---|---|---|
| `cmd/envd` | Go | CLI utama (up, build, destroy, context, env, exec, ...) |
| `cmd/envd-sshd` | Go | SSH daemon yang di-inject ke image untuk runtime access |
| `go.starlark.net` | Go | Interpreter Starlark untuk `build.envd` |
| BuildKit (`moby/buildkit`) | Go | Backend builder untuk image OCI |
| `envd-server` (repo eksternal) | Go | Backend untuk konteks Kubernetes |
| `base-images/envd`, `base-images/envd-sshd`, `base-images/remote-cache` | Dockerfile + bash | Base image + image cache remote |

## 1.2 Alur `envd up`
1. CLI membaca `build.envd` di cwd.
2. Interpreter Starlark (via `go.starlark.net`) mengevaluasi `def build(): ...` → AST build graph.
3. Graph diterjemahkan ke LLB (Low Level Build) BuildKit (`buildkit.LLB`), termasuk:
   - `base(dev=True)` → pilih base image
   - `install.*` → layer install (apt, conda, python_packages, cuda, ...)
   - `shell(...)` → shell default + konfigurasi
   - `config.*` → Jupyter, git, env vars, mount hooks
4. BuildKit mengeksekusi LLB → OCI image. Caching via local + remote registry.
5. Kontainer dijalankan dengen SSH port forward; `envd-sshd` melayani sesi `ssh`/`vscode`/`jupyter`.
6. CLI menempelkan identitas via `~/.ssh/config` (Host envd) supaya user bisa langsung `ssh <env-name>`.

## 1.3 Context Abstraction
```
local  → Docker daemon (buildkit container)        → container langsung
cluster→ envd-server Kubernetes API (buildkit pod)  → pod di namespace user
```
`envd context create --name docker --builder docker-container --use` adalah perintah yang dipakai oleh script build envd sendiri (lihat `base-images/remote-cache/build-and-push-remote-cache.sh`).

## 1.4 Reproducibility
Tiga pilar reproducible:
- **Starlark** sebagai sumber tunggal kebenaran (deterministik, no side effect).
- **BuildKit cache** lokal + registry: `--export-cache type=registry,ref=ghcr.io/...`.
- **OCI image spec**: hasil build bisa dipush/dipull via Docker Hub/Harbor, dan jalan di runtime apapun.

# 2. Pola Desain & Teknik Coding Kunci

## 2.1 DSL sebagai API Publik, Go sebagai Runtime
`envd` meniru pendekatan `make`/`bazel`: bahasa konfigurasi (Starlark) ditulis oleh user, tetapi tidak ada interpreter terpisah — CLI Go yang membaca file. Ini menghindari "two binaries" dan memberi error reporting langsung dari CLI.

Manfaat:
- Tidak ada DSL kustom → zero learning curve (bilang sendiri: "without learning a new language or DSL").
- Karena Starlark adalah subset Python, IDE/linter Python tetap bisa membantu (lihat `pyproject.toml` → ruff `extend-include = ["*.envd"]`).

## 2.2 BuildKit LLB Sebagai Intermediate Representation
Alih-alih menghasilkan `Dockerfile` string (rapuh), `envd` membangun LLB graph langsung. Ini memberi:
- Deteksi cache byte-level (bukan baris-per-baris).
- Multi-platform build (`linux/amd64,linux/arm64` di `base-images/envd/build.sh`).
- Eksekusi paralel layer independen.

## 2.3 Sidecar SSH Daemon (`envd-sshd`)
Runtime bukan `docker exec` — ini penting untuk pengalaman VSCode Remote / Jupyter. Pola yang sama dengan GitHub Codespaces: image berisi daemon SSH khusus yang dikonfigurasi via env var saat container start.

## 2.4 Bootstrap Binary dari Python Package
`setup.py` cerdas: jika `bin/envd` belum ada (fresh clone), ia memanggil `make build-release` on-the-fly. Ini trik "self-bootstrapping" sehingga `pip install envd` dari source menghasilkan binary yang cocok. `.GIT_TAG_INFO` (digenerate oleh `make generate-git-tag-info`) memastikan `envd version --short` benar saat distribusi sdist.

```python
class EnvdExtension(Extension):
    """Extension for `envd`"""

class EnvdBuildExt(build_ext):
    def build_extension(self, ext: Extension) -> None:
        if not isinstance(ext, EnvdExtension):
            return super().build_extension(ext)
        build_envd_if_not_found()
```

Pola ini umum di proyek hybrid Go+Python (mis. `poetry`, `uv` sebagian): setuptools dijadikan wrapper build Go.

## 2.5 Universal Wheel Tag
```python
class bdist_wheel_universal(bdist_wheel):
    def get_tag(self):
        *_, plat = super().get_tag()
        return "py2.py3", "none", plat
```
Wheel di-tag `py2.py3-none-<plat>` karena binary Go bukan ABI Python — memperluas kompatibilitas.

## 2.6 Remote Cache Sebagai First-Class Citizen
Shell helper di `base-images/remote-cache/build-and-push-remote-cache.sh` secara eksplisit melakukan:
```sh
envd context create --name docker --builder docker-container --use
envd --debug build -f build.envd:${BUILD_FUNC} \
  --export-cache type=registry,ref=ghcr.io/${DOCKER_HUB_ORG}/python-cache:envd-v${ENVD_VERSION}${TAG_SUFFIX} \
  --force
```
Artinya caching bukan opsi tersembunyi — dipromosikan sebagai fitur utama (reproducible + fast).

## 2.7 Konfigurasi CI/CD
- `.goreleaser.yaml` → cross-compile multi-arch binary.
- `.pre-commit-config.yaml` + `.golangci.yml` + ruff (lihat `pyproject.toml`).
- `CODEOWNERS`, `OWNERS` → governance multi-level (bukan satu maintainer).

# 3. Cuplikan Kode Kunci & Cara Kerja Fungsi

## 3.1 Contoh `build.envd`
```python
def build():
    base(dev=True)
    install.conda()
    install.python()
    install.python_packages(name = [
        "numpy",
    ])
    shell("fish")
    config.jupyter()
```
**Cara kerja:** Setiap `install.*` / `config.*` adalah fungsi Starlark yang,

---
### Struktur Berkas Utama
```
📄 .all-contributorsrc
📄 .editorconfig
📄 .gitignore
📄 .golangci.yml
📄 .goreleaser.yaml
📄 .pre-commit-config.yaml
📁 .vscode/
   └─ 📄 launch.json
📄 CHANGELOG.md
📄 CODEOWNERS
📄 CODE_OF_CONDUCT.md
📄 LICENSE
📄 MANIFEST.in
📄 Makefile
📄 OWNERS
📄 README.md
📁 base-images/
   └─ 📁 envd
   └─ 📁 envd-sshd
   └─ 📁 remote-cache
📄 build.envd
📁 cmd/
   └─ 📁 envd
   └─ 📁 envd-sshd
📁 docs/
   └─ 📄 README.md
   └─ 📁 proposals
📁 e2e/
   └─ 📁 cli
   └─ 📁 docs
   └─ 📄 e2e_helper.go
   └─ 📁 language
📁 envd/
   └─ 📁 api
   └─ 📄 api.go
```
