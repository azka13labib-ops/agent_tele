const { dlToolDefinitions } = require('./dl_tools');
const { knowledgeToolDefinitions } = require('../services/knowledge_manager');

const coreToolDefinitions = [
  {
    type: "function",
    function: {
      name: "lihat_folder",
      description: "Melihat daftar file dan subfolder di suatu direktori lokal",
      parameters: {
        type: "object",
        properties: {
          pathFolder: {
            type: "string",
            description: "Path folder yang ingin dicek. Contoh: './', './src', 'C:/Users'"
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
      name: "baca_file",
      description: "Membaca isi teks dari sebuah file lokal dengan baris terformat",
      parameters: {
        type: "object",
        properties: {
          namaFile: {
            type: "string",
            description: "Path file yang ingin dibaca. Contoh: './index.js', 'package.json'"
          },
          startLine: {
            type: "number",
            description: "Nomor baris awal untuk mulai membaca (opsional, default: 1)"
          },
          maxLines: {
            type: "number",
            description: "Jumlah maksimum baris yang ingin dibaca (opsional, default: 100)"
          }
        },
        required: ["namaFile"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "tulis_file",
      description: "Membuat file baru atau memperbarui isi file lokal secara menyeluruh",
      parameters: {
        type: "object",
        properties: {
          namaFile: {
            type: "string",
            description: "Path file tujuan yang ingin dibuat/ditulis"
          },
          konten: {
            type: "string",
            description: "Isi teks/kode lengkap yang akan ditulis ke file"
          },
          penjelasan: {
            type: "string",
            description: "Penjelasan singkat perubahan atau tujuan penulisan file ini"
          }
        },
        required: ["namaFile", "konten", "penjelasan"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "jalankan_cmd",
      description: "Menjalankan perintah PowerShell di komputer Windows lokal",
      parameters: {
        type: "object",
        properties: {
          perintah: {
            type: "string",
            description: "Perintah PowerShell yang akan dieksekusi di Windows"
          },
          penjelasan: {
            type: "string",
            description: "Penjelasan singkat alasan dan tujuan perintah ini dijalankan"
          }
        },
        required: ["perintah", "penjelasan"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "cari_file",
      description: "Mencari file atau folder berdasarkan nama/kata kunci secara rekursif",
      parameters: {
        type: "object",
        properties: {
          kataKunci: {
            type: "string",
            description: "Nama file atau pola kata kunci yang dicari"
          },
          rootFolder: {
            type: "string",
            description: "Folder awal pencarian (opsional, default: './')"
          }
        },
        required: ["kataKunci"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "baca_web",
      description: "Membaca dan mengekstrak isi teks bersih dari sebuah halaman website atau URL tanpa perlu terminal (seperti read_url_content di Antigravity)",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "Alamat URL website yang ingin dibaca (contoh: 'https://styles.refero.design/...')"
          },
          fokus: {
            type: "string",
            description: "Topik atau kata kunci yang ingin difokuskan (opsional)"
          }
        },
        required: ["url"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atur_auto_accept",
      description: "Mengatur mode Auto-Accept (eksekusi otomatis perintah PowerShell & pembuatan file tanpa konfirmasi manual)",
      parameters: {
        type: "object",
        properties: {
          aktif: {
            type: "boolean",
            description: "true untuk mengaktifkan Auto-Accept (eksekusi instan), false untuk mematikan (butuh konfirmasi manual)"
          }
        },
        required: ["aktif"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atur_workspace",
      description: "Mengatur direktori kerja aktif default (workspace) untuk eksekusi terminal PowerShell dan operasi berkas",
      parameters: {
        type: "object",
        properties: {
          pathDirektori: {
            type: "string",
            description: "Path direktori workspace baru. Contoh: 'c:\\ngodink', 'c:\\ngodink\\tele-hermes-bot', 'C:\\Users\\azka\\dl-workspace'"
          }
        },
        required: ["pathDirektori"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "atur_auto_learn",
      description: "Mengatur mode pembelajaran mandiri otomatis berkala (Autonomous Hourly Learning)",
      parameters: {
        type: "object",
        properties: {
          aktif: {
            type: "boolean",
            description: "true untuk mengaktifkan belajar otomatis tiap 1 jam, false untuk mematikan"
          }
        },
        required: ["aktif"],
        additionalProperties: false
      }
    }
  },
  {
    type: "function",
    function: {
      name: "tambah_watchlist",
      description: "Menambahkan URL repositori GitHub atau link artikel ke antrean prioritas pembelajaran mandiri Hermes",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "URL lengkap repositori atau artikel yang ingin dipelajari"
          },
          topik: {
            type: "string",
            description: "Topik atau fokus pembelajaran (opsional)"
          }
        },
        required: ["url"],
        additionalProperties: false
      }
    }
  }
];

const allTools = [
  ...coreToolDefinitions,
  ...dlToolDefinitions,
  ...knowledgeToolDefinitions
];

module.exports = {
  coreToolDefinitions,
  allTools
};

