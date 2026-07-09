# Panduan Pengguna — Dashboard Revitalisasi Rusun Perumnas

**URL Aplikasi:** https://revitalisasi-monitoring-3qbs.vercel.app

## Peran Pengguna

| Peran | Bisa Apa |
|-------|----------|
| Viewer | Lihat semua data (kegiatan, Gantt, risiko, RACI, pelaporan) di semua lokasi. Tidak bisa mengubah apa pun. |
| Admin | Semua hak Viewer, ditambah: tambah/ubah/hapus kegiatan & dependensi, kelola risiko, isi RACI & pelaporan, kelola Kalender Kerja. |
| Super Admin | Semua hak Admin, ditambah: kelola akun pengguna & lokasi, lihat Audit Log. |

## Login

Buka URL aplikasi, masukkan email dan password yang diberikan admin sistem. Lupa password: hubungi Super Admin untuk direset lewat Supabase Dashboard (belum ada fitur lupa-password mandiri di versi ini).

## Kegiatan & Jadwal (per Lokasi)

- Pilih lokasi dari halaman utama, lalu pilih tab Fase (F1-F4).
- Tombol **+ Tambah Kegiatan** menambah baris baru. Setiap kolom (nama, tanggal, PIC, progress) tersimpan otomatis saat diubah (autosave).
- Ikon gembok mengunci tanggal kegiatan — kegiatan terkunci tidak ikut bergeser walau kegiatan lain sebelumnya berubah jadwal.
- Ikon "Dep" membuka panel dependensi — atur kegiatan mana yang harus selesai/mulai dulu sebelum kegiatan ini.

## Timeline (Gantt)

- 3 lapis bar: abu-abu (baseline/rencana awal), biru (rencana terkini), hijau/kuning (realisasi).
- Kegiatan pada jalur kritis (tidak punya waktu longgar) ditandai merah.
- Klik "Kelola Baseline" untuk menyimpan snapshot rencana saat ini sebagai pembanding.

## Risiko

- Halaman Risiko per lokasi: tambah risiko dengan Probabilitas (1-5) dan Dampak (1-5) — Skor terhitung otomatis, muncul di Risk Matrix (hijau/kuning/merah).

## RACI & Pelaporan

- Halaman RACI (global, semua lokasi): matriks tanggung jawab per fase x pemangku kepentingan.
- Halaman Pelaporan (global): daftar rencana pelaporan proyek, dapat diubah Admin.

## Ringkasan Mingguan

- Per lokasi, tombol "Salin ke Clipboard" menyalin ringkasan siap-tempel untuk WhatsApp/email.

## Users & Lokasi, Audit Log (Super Admin saja)

- "Users & Lokasi": tambah/nonaktifkan pengguna, kelola daftar lokasi.
- "Audit Log": riwayat semua perubahan data, siapa mengubah apa dan kapan, dengan detail sebelum/sesudah.

## Masalah Umum

- Halaman kosong/error setelah login → coba refresh; jika berulang, hubungi maintainer teknis (lihat `runbook-teknis.md`).
- Tanggal kegiatan tidak berubah walau dependensi diubah → cek apakah kegiatan tersebut dikunci (ikon gembok).
