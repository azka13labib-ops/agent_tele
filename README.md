# ⚡ Hermes: Hybrid Autonomous AI Copilot
> **Your 24/7 personal Telegram AI developer agent that bridges directly to your local GPU rig over a private Tailscale mesh.**

Hermes is an autonomous AI developer agent built for Telegram. It runs 24/7 on a lightweight cloud/VPS server (Docker) to keep your bot always responsive, while seamlessly reaching into your local Windows workstation over an encrypted **Tailscale** tunnel to execute PowerShell commands, monitor an **NVIDIA RTX 4060 GPU**, inspect PyTorch/CUDA environments, and manage local project files.

---

## 🏗️ Architecture

```text
 ┌─────────────────────────────────────────────────────────────┐
 │                     Telegram Client                         │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │       24/7 Cloud / VPS Server (Linux / Docker)              │
 │  • Telegram Bot Polling Engine                              │
 │  • Multi-Session State & Conversation History               │
 │  • AI ReAct Multi-Step Agent Loop                           │
 └──────────────────────────────┬──────────────────────────────┘
                                │ (Encrypted Tailscale Mesh VPN)
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │       Local Workstation (Windows / RTX 4060 8GB)            │
 │  • 9Router / LLM Inference Gateway (:20128)                 │
 │  • Hermes Laptop Worker Daemon (:20130)                     │
 │  • Native Windows PowerShell Execution                      │
 │  • NVIDIA GPU & PyTorch Deep Learning Suite                 │
 │  • Local Filesystem Read / Write                            │
 └─────────────────────────────────────────────────────────────┘
```

- **When your laptop is ON:** Hermes in the cloud delegates GPU checks, dataset inspections, file edits, and terminal commands directly to your local PC.
- **When your laptop is OFF / Sleep:** Hermes stays online 24/7 in the cloud to answer questions, discuss architecture, and chat, while politely holding back tasks that require local hardware.

---

## ✨ Key Features

- **🌐 Hybrid Server ↔ Local Rig:** Run the bot 24/7 in Docker while your heavy hardware stays safe at home.
- **🧠 Continuous Self-Learning (`/learn <url>`):** Paste any GitHub repo, ArXiv research paper, HuggingFace model, raw script, or technical article. Hermes digests the architecture, summarizes key takeaways, and permanently commits them to long-term memory across all future chats.
- **🎮 Deep Learning & Hardware Aware:** Designed with awareness of an **NVIDIA GeForce RTX 4060 Laptop GPU (8GB VRAM)**. Recommends AMP (`float16`/`bfloat16`), Gradient Accumulation, and QLoRA/bitsandbytes to prevent CUDA Out Of Memory (OOM).
- **🔒 Enterprise-Grade Security & Autonomous Control:**
  - **Telegram ID Whitelist (RBAC):** Only your authorized Telegram ID can interact with or command the bot. Strangers are immediately blocked.
  - **Human-in-the-Loop Confirmation:** Destructive commands (`jalankan_cmd`, `tulis_file`) trigger an interactive Telegram approval button before execution.
  - **⚡ Toggleable Auto-Accept Mode:** Want Hermes to work autonomously without manual approval prompts? Toggle Auto-Accept instantly via `/settings` or `/autoaccept on`!
  - **Secret Shield:** Files like `.env` are strictly blocked from tool inspection.
- **📂 Persistent Multi-Session Engine:** Supports multiple named chats (e.g. `/new Training Model`), session switching (`/sessions`), and per-session context isolation saved to disk.
- **⚡ Zero-Touch Background Worker:** The Windows laptop worker runs silently as a background service via VBScript without pop-up command windows.

---

## ⌨️ Telegram Commands

| Command | Description |
| :--- | :--- |
| `/start` | Overview and quick navigation |
| `/settings` | Interactive panel to toggle Auto-Accept & bot preferences |
| `/autoaccept [on/off]` | Instant shortcut to enable or disable autonomous execution |
| `/laptop` or `/status` | Real-time connection latency and laptop worker health check |
| `/gpu` | Real-time NVIDIA GPU stats (VRAM usage, temperature, utilization, processes) |
| `/env` | Checks Python version, PyTorch, CUDA, cuDNN, and uv tooling |
| `/learn <url>` | Autonomously clones/reads and commits knowledge from GitHub, ArXiv, or web docs |
| `/brain` | Lists all permanently retained skills and technical notes |
| `/sessions` | Interactive inline keyboard to view, switch, and delete sessions |
| `/new [title]` | Creates a fresh, isolated conversation session |
| `/session` | Details of the active session |
| `/rename <title>` | Renames the current active session |
| `/reset` | Cleans current session history while preserving learned knowledge |

---

## 🛠️ Quick Start

### 1. Prerequisites
- Node.js 18+ (tested on Node v22)
- Telegram Bot Token from [@BotFather](https://t.me/BotFather)
- Tailscale installed on both your Server and Laptop (if using hybrid mode)

### 2. Setup on Local Laptop (Worker)
1. Clone this repository:
   ```bash
   git clone https://github.com/azka13labib-ops/agent_tele.git
   cd agent_tele
   npm install
   ```
2. Configure `.env`:
   ```bash
   cp .env.example .env
   ```
   Fill in your `TELEGRAM_TOKEN`, `OWNER_ID`, and AI API credentials.
3. Start the laptop worker:
   ```powershell
   node laptop_worker.js
   ```
   *(Or double click `start_laptop_worker.bat` / copy `hermes_worker.vbs` to Windows Startup for silent zero-touch boot).*

### 3. Setup on 24/7 Cloud Server (Docker)
1. Clone the repository on your server:
   ```bash
   git clone https://github.com/azka13labib-ops/agent_tele.git
   cd agent_tele
   ```
2. Create `.env` from template:
   ```bash
   cp .env.example .env
   ```
   Set `AI_BASE_URL` and `REMOTE_WORKER_URL` to your laptop's Tailscale IP (e.g. `http://100.85.233.8:20130`).
3. Launch with Docker Compose:
   ```bash
   docker compose up -d
   ```
4. View live logs:
   ```bash
   docker compose logs -f
   ```

---

## ⚙️ Environment Variables

```env
# Telegram
TELEGRAM_TOKEN=123456789:ABCdefGHIjklMNOpqrSTUvwxYZ

# AI Gateway (9Router / Token Harbor / OpenRouter / OpenAI)
AI_BASE_URL=http://localhost:20128/v1
AI_API_KEY=sk-...
AI_MODEL=agent_tele

# Security Access Control
OWNER_ID=7844072537

# Hybrid Remote Bridge (Server mode only)
REMOTE_WORKER_URL=http://100.x.y.z:20130
WORKER_SECRET=hermes-tailscale-secret
```

---

## 📄 License
MIT License. Built with passion for autonomous AI engineering.
