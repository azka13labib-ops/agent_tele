# 🌐 Attention Is All You Need

- **URL Sumber:** https://arxiv.org/abs/1706.03762
- **Tipe Materi:** research_paper
- **Waktu Dipelajari:** 25/9/2026, 04.30.09
- **Tags:** arxiv, paper-ai, research
- **Ringkasan:** Paper ini memperkenalkan arsitektur Transformer, yang pertama kali mengandalkan mekanisme attention sepenuhnya tanpa memakai RNN/CNN untuk pemrosesan sekuensial. Transformer menjadi fondasi bagi model NLP modern seperti BERT, GPT, dan berbagai model multimodal. Kontribusi utamanya adalah multi-head self-attention, positional encoding, dan pelatihan yang sangat paralel dengan performa SOTA di bidang machine translation.

---

# 1. Konsep Utama & Latar Belakang

Paper "Attention Is All You Need" (Vaswani et al., 2017) menjawab keterbatasan model recurrent (RNN/LSTM) dalam menangani sekuens panjang dan keterbatasan paralelisasi. Arsitektur Transformer memperkenalkan **“self-attention”** atau **intra-attention**, yaitu mekanisme menghubungkan setiap posisi dalam sekuens ke semua posisi lain dalam satu lapisan.

Sebelum Transformer, model machine translation umumnya berbasis encoder-decoder dengan RNN. RNN membaca token secara berurutan, sehingga sulit diparalelkan dan sering mengalami *vanishing gradient* pada sekuens panjang. Attention sebelumnya hanya digunakan sebagai pelengkap pada encoder-decoder; paper ini membuktikan bahwa attention yang diterapkan secara menyeluruh cukup untuk mencapai performa terbaik tanpa RNN/CNN.

Konsep kunci yang menjadi latar belakang:

- **Self-attention**: setiap token memperhatikan token lain dalam kalimat yang sama untuk membangun representasi kontekstual.
- **Paralelisasi tinggi**: tidak ada ketergantungan sekuensial, sehingga pelatihan jauh lebih cepat dibanding RNN.
- **General-purpose feature extractor**: arsitektur bisa diterapkan tidak hanya pada teks, tetapi juga visi, audio, hingga graf.

# 2. Metode, Arsitektur, atau Alur Kerja Kunci

Arsitektur Transformer mengikuti struktur encoder-decoder:

- **Encoder**: terdiri dari N lapisan (default 6). Setiap lapisan memiliki dua sub-lapisan:
  1. Multi-head self-attention.
  2. Position-wise feed-forward network (FFN).
  
  Setiap sub-lapisan ditambah dengan **residual connection** lalu diikuti **layer normalization**: `LayerNorm(x + Sublayer(x))`.

- **Decoder**: juga N lapisan. Setiap lapisan memiliki tiga sub-lapisan:
  1. Masked multi-head self-attention (untuk mencegah model “melihat” token di masa depan saat prediksi).
  2. Multi-head attention yang memperhatikan output encoder (encoder-decoder attention).
  3. Position-wise feed-forward network.

  Masking dilakukan dengan menset skor attention untuk posisi masa depan menjadi `-inf` sebelum softmax.

## Skala / Alur kerja

1. **Input Embedding**: token dikonversi menjadi vektor berdimensi `d_model` (default 512).
2. **Positional Encoding**: ditambahkan ke embedding untuk menyuntikkan urutan posisi. Formula:

   ```
   PE(pos, 2i)   = sin(pos / 10000^(2i / d_model))
   PE(pos, 2i+1) = cos(pos / 10000^(2i / d_model))
   ```

3. **Scaled Dot-Product Attention**:

   ```
   Attention(Q, K, V) = softmax(Q K^T / sqrt(d_k)) V
   ```

   Q dan K berdimensi `d_k`, V berdimensi `d_v`. Pembagian dengan `sqrt(d_k)` mencegah perkalian dot menghasilkan nilai besar yang membuat softmax berada di region gradien sangat kecil.

4. **Multi-Head Attention**: proyeksikan Q, K, V h kali dengan matriks bobot berbeda, hitung attention secara paralel, lalu gabungkan:

   ```
   MultiHead(Q, K, V) = Concat(head_1, ..., head_h) W^O
   head_i = Attention(Q W_i^Q, K W_i^K, V W_i^V)
   ```

   Umumnya `h = 8`, sehingga dengan `d_model = 512`, setiap head memiliki dimensi `d_k = d_v = d_model / h = 64`.

5. **Feed-Forward Network**: dua lapisan linear dengan aktivasi ReLU di antaranya:

   ```
   FFN(x) = max(0, x W_1 + b_1) W_2 + b_2
   ```

   Dimensi inner biasanya `d_ff = 2048`.

6. **Output**: linear + softmax untuk menghasilkan distribusi probabilitas token.

# 3. Snippet Kode / Formula / Implementasi Praktis

Paper ini tidak menyertakan kode, tetapi implementasi konsep inti dalam PyTorch dapat ditulis seperti berikut.

```python
import torch
import torch.nn as nn
import torch.nn.functional as F
import math

class ScaledDotProductAttention(nn.Module):
    def __init__(self, dropout=0.0):
        super().__init__()
        self.dropout = nn.Dropout(dropout)

    def forward(self, q, k, v, mask=None):
        d_k = q.size(-1)
        scores = torch.matmul(q, k.transpose(-2, -1)) / math.sqrt(d_k)
        if mask is not None:
            scores = scores.masked_fill(mask == 0, float('-inf'))
        attn = F.softmax(scores, dim=-1)
        attn = self.dropout(attn)
        return torch.matmul(attn, v), attn

class MultiHeadAttention(nn.Module):
    def __init__(self, d_model=512, h=8, dropout=0.1):
        super().__init__()
        assert d_model % h == 0
        self.h = h
        self.d_k = d_model // h
        self.w_q = nn.Linear(d_model, d_model)
        self.w_k = nn.Linear(d_model, d_model)
        self.w_v = nn.Linear(d_model, d_model)
        self.w_o = nn.Linear(d_model, d_model)
        self.attn = ScaledDotProductAttention(dropout)

    def forward(self, q, k, v, mask=None):
        batch_size = q.size(0)

        q = self.w_q(q).view(batch_size, -1, self.h, self.d_k).transpose(1, 2)
        k = self.w_k(k).view(batch_size, -1, self.h, self.d_k).transpose(1, 2)
        v = self.w_v(v).view(batch_size, -1, self.h, self.d_k).transpose(1, 2)

        x, attn = self.attn(q, k, v, mask)

        x = x.transpose(1, 2).contiguous().view(batch_size, -1, self
