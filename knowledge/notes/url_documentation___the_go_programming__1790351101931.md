# 🌐 Documentation - The Go Programming Language

- **URL Sumber:** https://go.dev/doc/
- **Tipe Materi:** documentation
- **Waktu Dipelajari:** 25/9/2026, 15.45.01
- **Tags:** golang, docs, guide, reference, concurrency, modules, toolchain, generics, fuzzing, profiling, best-practices
- **Ringkasan:** Halaman indeks resmi dokumentasi Bahasa Pemrograman Go yang menjadi pintu masuk ke seluruh ekosistem dokumentasi Go — mulai dari instalasi, tutorial pemula, konsep inti (concurrency, type system, garbage collection), hingga referensi lanjutan seperti Language Specification, Go Modules Reference, dan Go Memory Model. Materi ini penting karena memetakan seluruh knowledge base Go yang dibutuhkan engineer untuk menguasai bahasa, toolchain, dan praktik idiomatiknya secara end-to-end.

---

# 1. Konsep Utama & Latar Belakang

## 1.1 Filosofi Bahasa Go
Go (`golang`) adalah proyek open source yang dirancang dengan empat nilai utama: **expressive, concise, clean, dan efficient**. Nilai-nilai ini muncul dari keputusan desain berikut:

- **Statically typed + compiled → machine code**: Memberikan kecepatan eksekusi native tanpa runtime interpreter.
- **Garbage collection**: Menghilangkan beban manual memory management tanpa mengorbankan performa.
- **Runtime reflection**: Memberikan fleksibilitas seperti bahasa dinamis (mis. marshaling `encoding/json`, `gob`, ORM).
- **Concurrency primitives first-class**: `goroutine` dan `channel` adalah bagian dari bahasa, bukan library — memudahkan pemanfaatan multicore dan networked machines.
- **Novel type system**: Interface (structural typing) + generics (type parameters) memungkinkan komposisi modular.

Frasa kunci dari dokumentasi resmi: *"It's a fast, statically typed, compiled language that feels like a dynamically typed, interpreted language."*

## 1.2 Peta Besar Dokumentasi
Dokumentasi Go dipecah menjadi beberapa kategori besar yang merefleksikan tahapan pembelajaran:

1. **Getting Started** — instalasi, Hello World, module, multi-module workspaces, REST API, generics, fuzzing, web apps.
2. **Using and Understanding Go** — Effective Go, FAQ, IDE plugins, Diagnostics, GC guide, dependency management, fuzzing, coverage, PGO, migrasi `encoding/json/v2`.
3. **References** — Package Docs, Command Docs, Language Specification, Go Modules Reference, `go.mod` reference, Go Memory Model, Contribution Guide, Release History.
4. **Accessing Databases** — `database/sql`, prepared statements, transactions, connection pooling, SQL injection avoidance.
5. **Developing Modules** — publishing workflow, versioning, organizing source, major version updates.
6. **Talks** — video talks tentang concurrency patterns, code adaptability, reflection.
7. **Codewalks** — guided tours kode: `defer/panic/recover`, concurrency patterns, JSON, `gob`, `reflect`, `image`, `encoding/json`.
8. **Wiki** — komunitas, dokumentasi non-English.

## 1.3 Konsep Kunci yang Harus Diingat AI Agent
- **Effective Go** adalah *"must read"* untuk penulis kode Go idiomatik; harus dibaca setelah Tour dan Language Spec.
- **The Go Memory Model** mendefinisikan *happens-before relations* — syarat mutlak untuk reasoning tentang concurrency correctness.
- **Language Specification** adalah sumber kebenaran final (source of truth) untuk semantik bahasa.
- **Go Modules Reference** adalah kontrak dependency management sejak Go 1.11+.

---

# 2. Metode, Arsitektur, atau Alur Kerja Kunci

## 2.1 Alur Belajar Resmi yang Direkomendasikan
Dokumentasi secara implisit menetapkan sequence berikut:

```
Getting Started (Hello World, Tour)
        ↓
A Tour of Go (syntax, methods, interfaces, generics, concurrency)
        ↓
Language Specification + Effective Go (idiomatic deep dive)
        ↓
Language-specific docs (Memory Model, Modules, Package Reference)
        ↓
Advanced topics (GC, PGO, Fuzzing, Coverage, Diagnostics, Race Detector)
```

## 2.2 Alur Kerja Module Development
Dari kategori **Developing Modules**, workflow standar:

1. **Collect related packages** menjadi satu module (dengan `go.mod`).
2. **Module release & versioning workflow** — pastikan pengalaman konsisten untuk konsumen.
3. **Manage module source** — ikuti repository conventions (mis. beri tag `vX.Y.Z` pada repo root).
4. **Organize module** — pilih layout sesuai tipe module (single package, multiple packages, dll).
5. **Publish** — push ke repo publik agar bisa di-resolve via `go get`.
6. **Major version update** — bump ke `v2+` sebagai *new module* jika ada breaking change (path menjadi `example.com/mod/v2`).

## 2.3 Alur Kerja Database (`database/sql`)
Dari kategori **Accessing databases**, lifecycle standar:

1. **Open handle** → `sql.Open("driver", dsn)` → handle adalah *connection pool*, bukan koneksi tunggal.
2. **Exec** untuk `INSERT`/`UPDATE`/`DELETE` (tidak return row).
3. **Query / QueryRow** untuk `SELECT`.
4. **Prepared statements** untuk operasi berulang → mengurangi overhead parsing/planning.
5. **Transactions** via `sql.Tx` → `Begin`, `Commit`, `Rollback`.
6. **Cancellation** via `context.Context` → opsional tapi penting untuk service long-running.
7. **Connection pool tuning** → `SetMaxOpenConns`, `SetMaxIdleConns`, `SetConnMaxLifetime`.
8. **Avoid SQL injection** → selalu gunakan parameter placeholder (`?` / `$1`), jangan string concatenation.

## 2.4 Alur Kerja Concurrency (dari Talks & Codewalks)
Pola kunci dari **Go Concurrency Patterns** dan **Advanced Go Concurrency Patterns**:
- **Generator pattern** → fungsi mengembalikan channel.
- **Fan-in / fan-out** → distribusi kerja ke banyak goroutine, gabung hasil.
- **Timeout / cancellation** → `select` + `time.After` atau `context.Context`.
- **Share memory by communicating** → kirim data lewat channel daripada shared variable + mutex.

## 2.5 Arsitektur Toolchain Modern
Dari **Tools** codewalk:
- `go` command: `build`, `test`, `run`, `install`, `mod`, `get`, `vet`, `fmt`, `work`.
- **gopls**: language server yang menyediakan autocomplete, refactoring, go-to-definition untuk semua editor.
- **Data Race Detector** (`-race`): mendeteksi data race saat runtime.
- **Profiling** (`pprof`): CPU, memory, block, mutex profiling.
- **PGO**: menggunakan profil produksi untuk mengoptimalkan binary pada build berikutnya.
- **Fuzzing** (`go test -fuzz`): generate input ekstrem untuk menemukan edge case & security bug.

---

# 3. Snippet Kode / Formula / Implementasi Praktis

## 3.1 Instalasi Tour of Go (dari dokumentasi)
```bash
$ go install golang.org/x/website/tour@latest
```
Binary `tour` akan diletakkan di `$GOPATH/bin` (atau `$HOME/go/bin` pada Go 1.16+).

## 3.2 Hello, World (idiomatik)
```go
package main

import "fmt"

func main() {
    fmt.Println("Hello, World!")
}
```

## 3.3 Membuat Module Baru
```bash
$ mkdir greetings && cd greetings
$ go mod init example.com/greetings
```
Menghasilkan `go.mod`:
```
module example.com/greetings

go 1.22
```

## 3.4 Multi-Module Workspace (Go 1.18
