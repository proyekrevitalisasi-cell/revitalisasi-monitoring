# Manual: Membuat Test Users di Supabase Cloud

Karena menggunakan Supabase Cloud (bukan Docker lokal), auth users dibuat
via Supabase Dashboard setelah migrations dijalankan.

## Langkah-langkah

Buka: https://supabase.com/dashboard/project/pfilwslwovsxgevgldbv/auth/users

Klik "Add user" → "Create new user" untuk setiap akun:

### 1. Super Admin
- Email: `superadmin@perumnas.co.id`
- Password: `SuperAdmin123!`
- Email Confirm: ✅ (centang "Auto Confirm User")

### 2. Admin
- Email: `admin@perumnas.co.id`
- Password: `Admin123!`
- Email Confirm: ✅

### 3. Viewer
- Email: `viewer@perumnas.co.id`
- Password: `Viewer123!`
- Email Confirm: ✅

## Setelah membuat user

Trigger `on_auth_user_created` akan otomatis membuat baris di `public.profiles`
dengan `role = 'viewer'` (default). Kamu perlu update role untuk SA dan Admin:

Di SQL Editor (https://supabase.com/dashboard/project/pfilwslwovsxgevgldbv/sql):

```sql
-- Update role Super Admin
UPDATE public.profiles
SET role = 'super_admin', full_name = 'Super Admin Perumnas'
WHERE email = 'superadmin@perumnas.co.id';

-- Update role Admin
UPDATE public.profiles
SET role = 'admin', full_name = 'Admin Perumnas'
WHERE email = 'admin@perumnas.co.id';

-- Update nama Viewer
UPDATE public.profiles
SET full_name = 'Viewer Perumnas'
WHERE email = 'viewer@perumnas.co.id';
```

## Verifikasi

Cek di Table Editor → profiles: harus ada 3 baris dengan role yang benar.
