const { execSync, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const dlToolDefinitions = [
  {
    type: "function",
    function: {
      name: "cek_gpu",
      description: "Memeriksa status GPU NVIDIA real-time: tipe kartu grafis, VRAM total, terpakai, sisa VRAM, suhu, dan proses komputasi AI/DL yang aktif.",
      parameters: {
        type: "object",
        properties: {},
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cek_env_dl",
      description: "Memeriksa environment AI & Deep Learning lokal: versi Python, ketersediaan PyTorch, CUDA, device GPU, dan package manager uv.",
      parameters: {
        type: "object",
        properties: {
          pythonPath: {
            type: "string",
            description: "Path binary Python opsional (default: 'python')"
          }
        },
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "inspeksi_dataset",
      description: "Menganalisis folder dataset (menghitung jumlah file per ekstensi, mendeteksi subfolder kelas/label, dan total ukuran dataset di disk).",
      parameters: {
        type: "object",
        properties: {
          pathFolder: {
            type: "string",
            description: "Path folder dataset yang ingin diperiksa"
          }
        },
        required: ["pathFolder"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "monitor_training",
      description: "Memonitor hasil/progress training model: membaca baris akhir file log training (misal: train.log) atau memeriksa file checkpoint (.pt, .pth, .safetensors, .onnx, .ckpt) terbaru.",
      parameters: {
        type: "object",
        properties: {
          pathFolderOrLog: {
            type: "string",
            description: "Path ke file log training atau folder tempat checkpoint model disimpan"
          }
        },
        required: ["pathFolderOrLog"],
        additionalProperties: false
      }
    }
  }
];

function handleDlTool(name, args) {
  if (name === "cek_gpu") {
    try {
      const rawGpu = execSync(
        'nvidia-smi --query-gpu=name,memory.total,memory.used,memory.free,temperature.gpu,utilization.gpu,driver_version --format=csv,noheader',
        { encoding: 'utf-8', timeout: 10000 }
      ).trim();
      const parts = rawGpu.split(',').map(s => s.trim());
      let report = `🖥️ Status GPU NVIDIA:\n` +
        `- Model: ${parts[0]}\n` +
        `- Total VRAM: ${parts[1]}\n` +
        `- VRAM Terpakai: ${parts[2]}\n` +
        `- Sisa VRAM: ${parts[3]}\n` +
        `- GPU Utilization: ${parts[5]}\n` +
        `- Suhu GPU: ${parts[4]}°C\n` +
        `- Driver Version: ${parts[6]}\n`;

      try {
        const rawProc = execSync(
          'nvidia-smi --query-compute-apps=pid,process_name,used_memory --format=csv,noheader',
          { encoding: 'utf-8', timeout: 5000 }
        ).trim();
        if (rawProc) {
          report += `\n⚙️ Proses yang Menggunakan VRAM:\n`;
          rawProc.split(/\r?\n/).forEach(p => {
            const [pid, pname, mem] = p.split(',').map(s => s.trim());
            report += `- [PID: ${pid}] ${pname} (${mem})\n`;
          });
        } else {
          report += `\n💡 Tidak ada proses komputasi yang sedang berjalan di GPU saat ini.`;
        }
      } catch {}

      return report;
    } catch (err) {
      return `Error membaca GPU: ${err.message}. Pastikan NVIDIA GPU dan driver nvidia-smi terinstall.`;
    }
  }

  if (name === "cek_env_dl") {
    const py = args.pythonPath || "python";
    let report = "🧪 Environment AI & Deep Learning Lokal:\n";

    try {
      const pyVer = execSync(`${py} --version`, { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim();
      report += `- Python: ${pyVer}\n`;
    } catch {
      report += `- Python: Tidak dapat dieksekusi (${py})\n`;
    }

    try {
      const uvVer = execSync('uv --version', { encoding: 'utf-8', timeout: 5000, stdio: 'pipe' }).trim();
      report += `- uv Package Manager: ${uvVer}\n`;
    } catch {
      report += `- uv: Belum terdeteksi di PATH\n`;
    }

    const testPyTorch = (pyExecutable) => {
      try {
        const code = "import torch; print(f'PyTorch: {torch.__version__} | CUDA Available: {torch.cuda.is_available()} | Device: {torch.cuda.get_device_name(0) if torch.cuda.is_available() else None}')";
        return execFileSync(pyExecutable, ['-c', code], { encoding: 'utf-8', timeout: 15000, stdio: 'pipe' }).trim();
      } catch {
        return null;
      }
    };

    const defaultTorch = testPyTorch(py);
    if (defaultTorch) {
      report += `- PyTorch Status: ${defaultTorch}\n`;
    } else {

      const candidateVenvs = [
        path.join(process.env.USERPROFILE || '', 'dl-workspace', '.venv', 'Scripts', 'python.exe'),
        path.resolve('./.venv/Scripts/python.exe'),
        path.resolve('./.venv/bin/python'),
        path.resolve('./venv/Scripts/python.exe'),
        path.resolve('./venv/bin/python')
      ];

      let found = false;
      for (const cand of candidateVenvs) {
        if (cand && fs.existsSync(cand)) {
          const res = testPyTorch(cand);
          if (res) {
            report += `- PyTorch Status: ${res}\n  (Terdeteksi di venv: ${cand})\n`;
            found = true;
            break;
          }
        }
      }

      if (!found) {
        report += `- PyTorch: Belum terinstall di environment Python default (bisa gunakan virtualenv / uv).\n`;
      }
    }

    return report;
  }

  if (name === "inspeksi_dataset") {
    const target = path.resolve(args.pathFolder || "./");
    if (!fs.existsSync(target)) return `Error: Folder dataset "${args.pathFolder}" tidak ditemukan.`;

    const extCount = {};
    const subdirs = [];
    let totalFiles = 0;
    let totalBytes = 0;

    function walk(dir, depth = 0) {
      if (totalFiles > 15000) return;
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const e of entries) {
        if (['node_modules', '.git', '.snapshots'].includes(e.name)) continue;
        const full = path.join(dir, e.name);
        if (e.isDirectory()) {
          if (depth === 0) subdirs.push(e.name);
          walk(full, depth + 1);
        } else {
          totalFiles++;
          const ext = path.extname(e.name).toLowerCase() || '[no_ext]';
          extCount[ext] = (extCount[ext] || 0) + 1;
          try { totalBytes += fs.statSync(full).size; } catch {}
        }
      }
    }

    try {
      walk(target);
      const sizeMb = (totalBytes / (1024 * 1024)).toFixed(2);
      let res = `📊 Analisis Dataset "${args.pathFolder}":\n` +
        `- Total File: ${totalFiles}\n` +
        `- Total Ukuran: ${sizeMb} MB\n\n` +
        `📁 Distribusi Format/Ekstensi:\n`;
      for (const [ext, count] of Object.entries(extCount)) {
        res += `- ${ext}: ${count} file\n`;
      }
      if (subdirs.length > 0) {
        res += `\n🏷️ Subfolder/Kelas Terdeteksi (${subdirs.length} kategori):\n` + subdirs.slice(0, 15).map(s => `- ${s}`).join('\n');
        if (subdirs.length > 15) res += `\n...dan ${subdirs.length - 15} folder lainnya`;
      }
      return res;
    } catch (err) {
      return `Error menganalisis dataset: ${err.message}`;
    }
  }

  if (name === "monitor_training") {
    const target = path.resolve(args.pathFolderOrLog || "./");
    if (!fs.existsSync(target)) return `Error: Path "${args.pathFolderOrLog}" tidak ditemukan.`;

    try {
      const stat = fs.statSync(target);
      if (!stat.isDirectory()) {
        const raw = fs.readFileSync(target, 'utf-8');
        const lines = raw.split(/\r?\n/).filter(l => l.trim().length > 0);
        const lastLines = lines.slice(-25).join('\n');
        return `📄 25 Baris Terakhir dari File Log "${args.pathFolderOrLog}":\n` + lastLines;
      } else {
        const files = [];
        function findCheckpoints(dir) {
          const entries = fs.readdirSync(dir, { withFileTypes: true });
          for (const e of entries) {
            const full = path.join(dir, e.name);
            if (e.isDirectory() && !['node_modules', '.git'].includes(e.name)) {
              try { findCheckpoints(full); } catch {}
            } else {
              const ext = path.extname(e.name).toLowerCase();
              if (['.pt', '.pth', '.safetensors', '.onnx', '.ckpt', '.bin'].includes(ext)) {
                try {
                  const s = fs.statSync(full);
                  files.push({ name: e.name, path: path.relative(target, full), sizeMb: (s.size / (1024 * 1024)).toFixed(2), mtime: s.mtime });
                } catch {}
              }
            }
          }
        }
        findCheckpoints(target);
        if (files.length === 0) return `Tidak ditemukan file model/checkpoint (.pt, .pth, .safetensors, dll) di folder "${args.pathFolderOrLog}".`;
        files.sort((a, b) => b.mtime - a.mtime);
        let res = `🏆 Checkpoint Model Ditemukan (${files.length} file, urutan terbaru):\n\n`;
        files.slice(0, 10).forEach((f, idx) => {
          res += `${idx + 1}. 📦 \`${f.path}\` (${f.sizeMb} MB) — ${f.mtime.toLocaleString('id-ID')}\n`;
        });
        return res;
      }
    } catch (err) {
      return `Error memonitor training: ${err.message}`;
    }
  }

  return null;
}

module.exports = {
  dlToolDefinitions,
  handleDlTool
};

