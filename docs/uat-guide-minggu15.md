# Panduan UAT — Dashboard Revitalisasi Rusun Perumnas (Staging)

**URL Staging:** https://revitalisasi-monitoring-3qbs.vercel.app

**Akun untuk testing:**
| Role | Email | Password |
|------|-------|----------|
| Super Admin | superadmin@perumnas.co.id | SuperAdmin123! |
| Admin | admin@perumnas.co.id | Admin123! |
| Viewer | viewer@perumnas.co.id | Viewer123! |

---

## 1. Login & Akses

- [ ] Login sebagai Viewer → pastikan tidak ada tombol edit di mana pun, tidak ada menu Users/Audit Log di sidebar
- [ ] Login sebagai Admin → pastikan semua fitur edit (tambah/ubah/hapus kegiatan, dsb) terbuka
- [ ] Login sebagai Super Admin → pastikan menu "Users & Lokasi" dan "Audit Log" muncul di sidebar

## 2. Kegiatan & Dependensi

- [ ] Buka salah satu lokasi (Tanah Abang, Kebon Kacang, Klender, atau Kemayoran Blok A), buka tab Fase 1 → tambah kegiatan baru
- [ ] Klik ikon dependensi (Dep) pada sebuah kegiatan → tambahkan predecessor dari kegiatan lain di Fase yang sama → simpan → cek tanggal kegiatan ini otomatis ikut menyesuaikan
- [ ] Coba buat dependensi yang membentuk siklus (A tergantung B, B tergantung A) → pastikan muncul pesan error dan tidak tersimpan
- [ ] Kunci (klik ikon gembok) tanggal sebuah kegiatan → ubah tanggal kegiatan predecessor-nya → pastikan kegiatan yang dikunci TIDAK ikut bergeser

## 3. Gantt Chart

- [ ] Buka halaman Timeline sebuah lokasi → pastikan muncul 3 lapis bar (baseline abu-abu, rencana biru, realisasi jika ada)
- [ ] Arahkan kursor ke sebuah bar → pastikan muncul tooltip info tanggal
- [ ] Cek kegiatan pada jalur kritis tampil dengan warna merah

## 4. Risk Register

- [ ] Buka halaman Risiko sebuah lokasi → tambah risiko baru dengan Probabilitas dan Dampak tertentu → pastikan Skor otomatis terhitung dan muncul di sel yang benar pada Risk Matrix
- [ ] Klik salah satu sel Risk Matrix → pastikan tabel ter-filter ke risiko-risiko di sel itu saja

## 5. Ringkasan Mingguan

- [ ] Buka halaman Ringkasan Mingguan sebuah lokasi → klik "Salin ke Clipboard" → coba tempel (paste) di WhatsApp atau aplikasi chat lain → pastikan formatnya rapi dan akurat

## 6. Workload View

- [ ] Buka halaman Workload → pastikan heatmap menampilkan semua PIC dan minggu kerja
- [ ] Cek sel yang berwarna merah — pastikan itu memang PIC dengan 4 atau lebih kegiatan aktif di minggu tersebut

---

**Catatan penting:** Ke-4 lokasi (Tanah Abang, Kebon Kacang, Klender, Kemayoran Blok A) baru saja diisi dengan kegiatan contoh (template standar 4 fase) khusus untuk keperluan UAT ini — tanggal-tanggalnya mulai dari 7 Juli 2026 dan belum mencerminkan jadwal riil proyek. Jangan ragu untuk mengubah/menghapus/menambah kegiatan sesuka hati selama sesi UAT; data ini memang untuk dicoba-coba, bukan data final.

**Catatan/Masalah yang ditemukan:**

(tulis di sini apa pun yang terasa aneh, salah, atau membingungkan saat testing)
