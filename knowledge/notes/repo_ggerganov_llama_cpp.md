# 📚 Catatan Pengetahuan: ggerganov/llama.cpp

- **URL:** https://github.com/ggerganov/llama.cpp.git
- **Waktu Dipelajari:** 26/9/2026, 06.37.22
- **Tags:** ggerganov, llama.cpp, llm-inference, c/c++, ggml, gguf, quantization, edge-inference, cuda, metal, vulkan, sycl, hip, cpu-simd, llama-server
- **Ringkasan:** llama.cpp adalah engine inferensi LLM/VLM yang ditulis murni dalam C/C++ di atas library tensor `ggml`, memungkinkan menjalankan model bahasa besar (Llama, Qwen, Mistral, Gemma, Phi, dll.) secara lokal di CPU maupun GPU dengan dependensi minimal. Repositori ini menyediakan pipeline lengkap: konversi model Hugging Face → GGUF, kuantisasi (Q4_K_M, IQ, dsb.), CLI chat (`llama-cli`), server OpenAI-compatible (`llama-server`), benchmarking, dan backend multi-hardware (CUDA, Metal, Vulkan, SYCL, HIP/ROCm, MUSA, CANN).

---

# 1. Konsep Utama & Arsitektur

## 1.1 Tujuan & Ruang Lingkup
`llama.cpp` bertujuan menjalankan inferensi LLM (dan sekarang juga VLM/vision-language models) dengan **setup minimal** dan **performa state-of-the-art** di berbagai hardware: laptop, edge device, mobile, hingga server cloud. Fokus utamanya adalah:
- **Portabilitas**: implementasi C/C++ tanpa dependensi runtime berat (tidak butuh Python/PyTorch saat inference).
- **Efisiensi memori**: kuantisasi agresif (hingga ~1.5 bit/parameter untuk model besar) + memory mapping file GGUF.
- **Performa**: SIMD dan kernel GPU yang dituning khusus per arsitektur.

## 1.2 Lapisan Arsitektur (dari bawah ke atas)

```
┌───────────────────────────────────────────────────────────────┐
│ tools/ & examples/                                            │
│   llama-cli, llama-server, llama-bench, llama-quantize,       │
│   llama-perplexity, llama-gguf, dsb. (binary CLI utilities)   │
├───────────────────────────────────────────────────────────────┤
│ libllama  (src/llama*.cpp)                                    │
│   Model loading, vocab, KV cache, sampling, context,          │
│   tokenizer (SentencePiece/BPE), grammar, speculative decode. │
├───────────────────────────────────────────────────────────────┤
│ ggml  (submodule ggml/)                                       │
│   Tensor ops, compute graph, memory allocator, scheduler,     │
│   backend registry.                                           │
├───────────────────────────────────────────────────────────────┤
│ ggml_backend_* (per-device)                                   │
│   CPU (AVX/NEON), CUDA, Metal, Vulkan, SYCL, HIP/ROCm,        │
│   MUSA, CANN (Ascend), OpenCL, RPC (remote).                  │
└───────────────────────────────────────────────────────────────┘
```

- **`ggml`**: library tensor low-level yang menyediakan operasi primitif (matmul, rope, attention, softmax). Semua model diekspresikan sebagai **DAG compute graph** yang dibangun sekali dan dieksekusi per token.
- **`libllama`**: layer semantik yang memahami struktur model (Llama, Qwen, Gemma, Mistral, dll.). Menyimpan `llama_model`, `llama_context`, `llama_kv_cache`, dan mengorkestrasi sampling.
- **Tools/CLI**: `llama-cli` (chat interaktif), `llama-server` (OpenAI-compatible REST), `llama-quantize`, `llama-bench`, `llama-perplexity`, `llama-gguf-split`, dsb.
- **Python scripts (top-level)**:
  - `convert_hf_to_gguf.py`: konversi Hugging Face checkpoint → GGUF.
  - `convert_lora_to_gguf.py`: adapter LoRA → GGUF.
  - `convert_llama_ggml_to_gguf.py`: format legacy → GGUF.
  - `gguf-py/`: package Python untuk membaca/menulis GGUF.

## 1.3 Format Model: GGUF
GGUF adalah file biner single-file yang memuat:
1. **Magic + version** (4 bytes + uint32).
2. **Metadata KV** (tipe file, arsitektur, hyperparameter, vocabulary, chat template, dll.).
3. **Tensor info** (nama, dimensi, tipe kuantisasi, offset).
4. **Tensor data** (aligned block-wise quantized).

Keunggulan: inference **zero-copy** via `mmap()`, sehingga loading model raksasa hampir instan dan hemat RAM (page cache OS yang menampungnya).

## 1.4 Alur Kerja (Workflow) End-to-End

```
[Hugging Face .safetensors / PyTorch .bin]
            │
            ▼  python convert_hf_to_gguf.py
       model-f16.gguf
            │
            ▼  ./llama-quantize model-f16.gguf model-Q4_K_M.gguf Q4_K_M
       model-Q4_K_M.gguf
            │
            ▼
   ./llama-cli -m model-Q4_K_M.gguf -p "Hello"    (CLI chat)
   ./llama-server -m model-Q4_K_M.gguf --port 8080 (REST API)
   ./llama-bench -m model-Q4_K_M.gguf               (benchmark)
```

## 1.5 Konfigurasi Build (CMake)
Build system berbasis **CMake + Ninja** dengan **CMakePresets.json** yang mendefinisikan banyak preset (mis. `x64-linux-gcc-release`, `arm64-apple-clang-release`, `vulkan`, dll.). Flag

---
### Struktur Berkas Utama
```
📄 .clang-format
📄 .clang-tidy
📁 .devops/
   └─ 📄 cann.Dockerfile
   └─ 📄 cpu.Dockerfile
   └─ 📄 cuda.Dockerfile
   └─ 📄 intel.Dockerfile
   └─ 📄 llama-cli-cann.Dockerfile
   └─ 📄 llama-cpp-cuda.srpm.spec
   └─ 📄 llama-cpp.srpm.spec
   └─ 📄 musa.Dockerfile
📄 .dockerignore
📄 .ecrc
📄 .editorconfig
📄 .flake8
📁 .gemini/
   └─ 📄 settings.json
📄 .gitignore
📄 .gitmodules
📁 .pi/
   └─ 📁 gg
📄 .pre-commit-config.yaml
📄 AGENTS.md
📄 AUTHORS
📄 CLAUDE.md
📄 CMakeLists.txt
📄 CMakePresets.json
📄 CODEOWNERS
📄 CONTRIBUTING.md
📄 LICENSE
📄 Makefile
📄 README.md
📄 SECURITY.md
📁 app/
   └─ 📄 CMakeLists.txt
```
