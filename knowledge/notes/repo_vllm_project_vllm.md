# 📚 Catatan Pengetahuan: vllm-project/vllm

- **URL:** https://github.com/vllm-project/vllm.git
- **Waktu Dipelajari:** 25/9/2026, 14.17.05
- **Tags:** vllm-project, vllm
- **Ringkasan:** Repositori vllm-project/vllm - Berhasil dipelajari dari README dan struktur kode.

---

## Analisis Repositori: vllm-project/vllm

**README:**
<!-- markdownlint-disable MD001 MD041 -->
<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://raw.githubusercontent.com/vllm-project/vllm/main/docs/assets/logos/vllm-logo-text-dark.png">
    <img alt="vLLM" src="https://raw.githubusercontent.com/vllm-project/vllm/main/docs/assets/logos/vllm-logo-text-light.png" width=55%>
  </picture>
</p>

<h3 align="center">
Easy, fast, and cheap LLM serving for everyone
</h3>

<p align="center">
| <a href="https://docs.vllm.ai"><b>Documentation</b></a> | <a href="https://blog.vllm.ai/"><b>Blog</b></a> | <a href="https://arxiv.org/abs/2309.06180"><b>Paper</b></a> | <a href="https://x.com/vllm_project"><b>Twitter/X</b></a> | <a href="https://discuss.vllm.ai"><b>User Forum</b></a> | <a href="https://slack.vllm.ai"><b>Developer Slack</b></a> |
</p>

🔥 We have built a vLLM website to help you get started with vLLM. Please visit [vllm.ai](https://vllm.ai) to learn more.
For events, please visit [vllm.ai/events](https://vllm.ai/events) to join us.

---

## About

vLLM is a fast and easy-to-use library for LLM inference and serving.

Originally developed in the [Sky Computing Lab](https://sky.cs.berkeley.edu) at UC Berkeley, vLLM has grown into one of the most active open-source AI projects built and maintained by a diverse community of many dozens of academic institutions and companies from over 2000 contributors.

vLLM is fast with:

- State-of-the-art serving throughput
- Efficient management of attention key and value memory with [**PagedAttention**](https://blog.vllm.ai/2023/06/20/vllm.html)
- Continuous batching of incoming requests, chunked prefill, prefix caching
- Fast and flexible model execution with piecewise and full CUDA/HIP graphs
- Quantization: FP8, MXFP8/MXFP4, NVFP4, INT8, INT4, GPTQ/AWQ, GGUF, compressed-tensors, ModelOpt, TorchAO, and [more](https://docs.vllm.ai/en/latest/features/quantization/index.html)
- Optimized attention kernels including FlashAttention, FlashInfer, TRTLLM-GEN, FlashMLA, and Triton
- Optimized GEMM/MoE kernels for various precisions using CUTLASS, TRTLLM-GEN, CuTeDSL
- Speculative decoding including n-gram, suffix, EAGLE, DFlash
- Automatic kernel generation and graph-level transformations using torch.compile
- Disaggregated prefill, decode, and encode

vLLM is flexible and easy to use with:

- Seamless integration with popular Hugging Face models
- High-throughput serving with various decoding algorithms, including *parallel sampling*, *beam search*, and more
- Tensor, pipeline, data, expert, and context parallelism for distributed inference
- Streaming outputs
- Generation of structured outputs using xgrammar or guidance
- Tool calling and reasoning parsers
- OpenAI-compatible API server, plus Anthropic Messages API and gRPC support
- Efficient multi-LoRA support for dense and MoE layers
- Support for NVIDIA GPUs, AMD GPUs, Intel GPUs, and x86/ARM/PowerPC CPUs. Additionally, diverse hardware plugins such as Google TPUs, Intel Ga

**Struktur Direktori:**
📁 .agents/
   └─ 📁 skills
📁 .buildkite/
   └─ 📄 .pipeline_gen_v2
   └─ 📁 amd-disagg
   └─ 📄 check-torch-abi.py
   └─ 📄 check-wheel-size.py
   └─ 📄 ci_config.yaml
   └─ 📄 ci_config_intel.yaml
   └─ 📄 ci_config_rocm.yaml
   └─ 📁 hardware_tests
📄 .clang-format
📁 .claude/
   └─ 📁 skills
📄 .dockerignore
📄 .git-blame-ignore-revs
📄 .gitignore
📄 .pre-commit-config.yaml
📄 .readthedocs.yaml
📄 AGENTS.md
📄 CMakeLists.txt
📄 DCO
📄 LICENSE
📄 MANIFEST.in
📄 README.md
📄 SECURITY.md
📁 benchmarks/
   └─ 📄 README.md
   └─ 📄 __init__.py
   └─ 📁 attention_benchmarks
   └─ 📁 auto_tune
   └─ 📄 backend_request_func.py
   └─ 📄 benchmark_batch_invariance.py
   └─ 📄 benchmark_block_pool.py
   └─ 📄 benchmark_hash.py
📁 cmake/
   └─ 📄 cpu_extension.cmake
   └─ 📁 external_projects
   └─ 📄 hipify.py
   └─ 📁 patches
   └─ 📄 utils.cmake
📁 csrc/
   └─ 📁 attention
   └─ 📄 cache.h
   └─ 📁 core
   └─ 📁 cpu
   └─ 📄 cuda_compat.h
   └─ 📄 cuda_utils.h
   └─ 📄 cumem_allocator.cpp
   └─ 📄 cumem_allocator_compat.h
📁 docker/
   └─ 📄 Dockerfile
   └─ 📄 Dockerfile.cpu
   └─ 📄 Dockerfile.ppc64le
   └─ 📄 Dockerfile.rock
   └─ 📄 Dockerfile.rock_base
   └─ 📄 Dockerfile.rocm
   └─ 📄 Dockerfile.rocm_base
   └─ 📄 Dockerfile.rocm_base_gfx1250
📁 docs/
   └─ 📄 .nav.yml
   └─ 📄 README.md
   └─ 📁 api
   └─ 📁 assets
   └─ 📁 benchmarking
   └─ 📁 cli
   └─ 📁 community
   └─ 📁 configuration
📁 examples/
   └─ 📄 __init__.py
   └─ 📁 applications
   └─ 📁 basic
   └─ 📁 deployment
   └─ 📁 disaggregated
   └─ 📁 features
   └─ 📁 generate
   └─ 📁 observability
📄 mkdocs.yaml
📄 pyproject.toml
📁 requirements/
   └─ 📁 build
   └─ 📄 common.txt
   └─ 📄 cpu.txt
   └─ 📄 cuda.txt
   └─ 📄 dev.txt
   └─ 📄 docs.in
   └─ 📄 docs.txt
   └─ 📄 kv_connectors.txt
📁 rust/
   └─ 📁 .config
   └─ 📄 .gitattributes
   └─ 📄 .gitignore
   └─ 📄 AGENTS.md
   └─ 📄 CLAUDE.md
   └─ 📄 Cargo.lock
   └─ 📄 Cargo.toml
   └─ 📄 README.md
📄 rust-toolchain.toml
📄 setup.py
📁 tests/
   └─ 📄 __init__.py
   └─ 📁 basic_correctness
   └─ 📁 benchmarks
   └─ 📄 ci_envs.py
   └─ 📁 compile
   └─ 📁 config
   └─ 📄 conftest.py
   └─ 📁 cuda
📁 tools/
   └─ 📄 __init__.py
   └─ 📄 autotune_helion_kernels.py
   └─ 📄 benchmark_helion_kernels.py
   └─ 📄 build_deepgemm_C.py
   └─ 📄 build_rust.py
   └─ 📄 build_rust.sh
   └─ 📄 build_triton_from_source.sh
   └─ 📄 check_repo.sh
📁 vllm/
   └─ 📄 __init__.py
   └─ 📄 _aiter_ops.py
   └─ 📄 _custom_ops.py
   └─ 📄 _xpu_ops.py
   └─ 📁 assets
   └─ 📁 benchmarks
   └─ 📄 collect_env.py
   └─ 📁 compilation

---
### Struktur Berkas Utama
```
📁 .agents/
   └─ 📁 skills
📁 .buildkite/
   └─ 📄 .pipeline_gen_v2
   └─ 📁 amd-disagg
   └─ 📄 check-torch-abi.py
   └─ 📄 check-wheel-size.py
   └─ 📄 ci_config.yaml
   └─ 📄 ci_config_intel.yaml
   └─ 📄 ci_config_rocm.yaml
   └─ 📁 hardware_tests
📄 .clang-format
📁 .claude/
   └─ 📁 skills
📄 .dockerignore
📄 .git-blame-ignore-revs
📄 .gitignore
📄 .pre-commit-config.yaml
📄 .readthedocs.yaml
📄 AGENTS.md
📄 CMakeLists.txt
📄 DCO
📄 LICENSE
📄 MANIFEST.in
📄 README.md
📄 SECURITY.md
📁 benchmarks/
   └─ 📄 README.md
   └─ 📄 __init__.py
   └─ 📁 attention_benchmarks
   └─ 📁 auto_tune
   └─ 📄 backend_request_func.py
   └─ 📄 benchmark_batch_invariance.py
   └─ 📄 benchmark_block_pool.py
   └─ 📄 benchmark_hash.py
```
