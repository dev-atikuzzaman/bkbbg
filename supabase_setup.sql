-- ═══════════════════════════════════════════════════════════════
--  BGFCL স্টক ইনভেন্টরি — Supabase Database Setup
--  এই স্ক্রিপ্টটি Supabase Dashboard → SQL Editor → New Query তে
--  পেস্ট করে "Run" চাপুন। একবারই রান করলেই যথেষ্ট।
-- ═══════════════════════════════════════════════════════════════

create extension if not exists "pgcrypto";

-- ───────────────────────────────────────────────
--  1) STOCK ITEMS টেবিল
-- ───────────────────────────────────────────────
create table if not exists public.stock_items (
  id uuid primary key default gen_random_uuid(),
  dept text not null,
  name text not null,
  qty numeric not null default 0,
  optimum numeric not null default 0,
  unit text,
  incoming numeric default 0,
  note text,
  month int not null,
  year int not null,
  created_at timestamptz default now()
);
alter table public.stock_items enable row level security;

drop policy if exists "stock_items_select_all" on public.stock_items;
create policy "stock_items_select_all" on public.stock_items
  for select using (true);

drop policy if exists "stock_items_insert_auth" on public.stock_items;
create policy "stock_items_insert_auth" on public.stock_items
  for insert to authenticated with check (true);

drop policy if exists "stock_items_update_auth" on public.stock_items;
create policy "stock_items_update_auth" on public.stock_items
  for update to authenticated using (true);

drop policy if exists "stock_items_delete_auth" on public.stock_items;
create policy "stock_items_delete_auth" on public.stock_items
  for delete to authenticated using (true);

-- ───────────────────────────────────────────────
--  2) UNLOAD LOGS টেবিল
-- ───────────────────────────────────────────────
create table if not exists public.unload_logs (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  dept text not null,
  item text not null,
  qty numeric not null default 0,
  unit text,
  location text not null,
  supplier text,
  month int not null,
  year int not null,
  created_at timestamptz default now()
);
alter table public.unload_logs enable row level security;

drop policy if exists "unload_logs_select_all" on public.unload_logs;
create policy "unload_logs_select_all" on public.unload_logs
  for select using (true);

drop policy if exists "unload_logs_insert_auth" on public.unload_logs;
create policy "unload_logs_insert_auth" on public.unload_logs
  for insert to authenticated with check (true);

drop policy if exists "unload_logs_delete_auth" on public.unload_logs;
create policy "unload_logs_delete_auth" on public.unload_logs
  for delete to authenticated using (true);

-- ───────────────────────────────────────────────
--  3) PROFILES টেবিল (সাইন-আপ / অ্যাডমিন অনুমোদন)
-- ───────────────────────────────────────────────
create table if not exists public.profiles (
  id uuid primary key,
  email text unique not null,
  name text,
  designation text,
  dept text,
  req_dept text,
  role text not null default 'pending',
  status text not null default 'pending',
  created_at timestamptz default now()
);
alter table public.profiles enable row level security;

drop policy if exists "profiles_select_all" on public.profiles;
create policy "profiles_select_all" on public.profiles
  for select using (true);

-- সাইন-আপের সময় নিজের প্রোফাইল তৈরি করা যাবে, কিন্তু শুধু 'pending' অবস্থায়
-- (কেউ নিজেকে সরাসরি admin/super বানাতে পারবে না)
drop policy if exists "profiles_insert_pending_only" on public.profiles;
create policy "profiles_insert_pending_only" on public.profiles
  for insert with check (role = 'pending' and status = 'pending');

-- শুধুমাত্র সুপার অ্যাডমিনের আসল লগইন-করা ইমেইল দিয়েই status/role পরিবর্তন (approve/reject) করা যাবে
drop policy if exists "profiles_update_super_admin_only" on public.profiles;
create policy "profiles_update_super_admin_only" on public.profiles
  for update to authenticated
  using (auth.jwt() ->> 'email' = 'atikuzzaman53@gmail.com')
  with check (auth.jwt() ->> 'email' = 'atikuzzaman53@gmail.com');

-- ───────────────────────────────────────────────
--  4) MANPOWER টেবিল (জনবল — দৈনিক শ্রমিক ও সাধারণ স্টাফ)
-- ───────────────────────────────────────────────
create table if not exists public.manpower (
  id uuid primary key default gen_random_uuid(),
  dept text not null,
  type text not null default 'daily', -- 'daily' | 'staff'
  name text not null,
  designation text,
  phone text,
  address text,
  cl_last_date date,
  cl_remaining numeric default 0,
  other_leave_last_date date,
  other_leave_remaining numeric default 0,
  al_taken text default 'no', -- 'yes' | 'no'
  created_at timestamptz default now()
);
alter table public.manpower enable row level security;

drop policy if exists "manpower_select_all" on public.manpower;
create policy "manpower_select_all" on public.manpower
  for select using (true);

drop policy if exists "manpower_insert_auth" on public.manpower;
create policy "manpower_insert_auth" on public.manpower
  for insert to authenticated with check (true);

drop policy if exists "manpower_update_auth" on public.manpower;
create policy "manpower_update_auth" on public.manpower
  for update to authenticated using (true);

drop policy if exists "manpower_delete_auth" on public.manpower;
create policy "manpower_delete_auth" on public.manpower
  for delete to authenticated using (true);

-- ───────────────────────────────────────────────
--  5) ACTIVITIES টেবিল (কার্যক্রম — শাখাভিত্তিক দৈনন্দিন কাজ)
-- ───────────────────────────────────────────────
create table if not exists public.activities (
  id uuid primary key default gen_random_uuid(),
  dept text not null,
  date date not null,
  description text not null,
  created_at timestamptz default now()
);
alter table public.activities enable row level security;

drop policy if exists "activities_select_all" on public.activities;
create policy "activities_select_all" on public.activities
  for select using (true);

drop policy if exists "activities_insert_auth" on public.activities;
create policy "activities_insert_auth" on public.activities
  for insert to authenticated with check (true);

drop policy if exists "activities_update_auth" on public.activities;
create policy "activities_update_auth" on public.activities
  for update to authenticated using (true);

drop policy if exists "activities_delete_auth" on public.activities;
create policy "activities_delete_auth" on public.activities
  for delete to authenticated using (true);

-- ═══════════════════════════════════════════════════════════════
--  শেষ। এখন অ্যাপ রিলোড করুন — "Offline / Not Synced" বদলে
--  "Online / Synced" দেখানো উচিত।
--
--  বিদ্যমান ব্যবহারকারীদের জন্য: শুধু এই নতুন অংশটুকু (৪ ও ৫ নং)
--  Supabase SQL Editor-এ আলাদাভাবে রান করলেই "জনবল" ও "কার্যক্রম"
--  ট্যাব ক্লাউড সিঙ্ক শুরু করবে। এটা রান না করলেও অ্যাপ ঠিকমতো
--  চলবে, শুধু ডেটা লোকাল (এই ডিভাইসে) থেকে যাবে, ক্লাউডে সিঙ্ক হবে না।
-- ═══════════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────
--  6) কাস্টম ফিল্ড ও AL তারিখ কলাম (বিদ্যমান টেবিলে যোগ)
--  আগে থেকে তৈরি stock_items/manpower/activities টেবিলে এই
--  কলামগুলো না থাকলে কাস্টম ফিল্ড ও AL নেয়ার তারিখ ক্লাউডে
--  সিঙ্ক হবে না (শুধু ডিভাইসে লোকালি সংরক্ষিত থাকবে)।
--  এই অংশটুকু আলাদাভাবে রান করলেই সমস্যা সমাধান হয়ে যাবে।
-- ───────────────────────────────────────────────
alter table public.stock_items add column if not exists "customFields" jsonb default '{}'::jsonb;
alter table public.manpower    add column if not exists "customFields" jsonb default '{}'::jsonb;
alter table public.activities  add column if not exists "customFields" jsonb default '{}'::jsonb;
alter table public.manpower    add column if not exists "alDate" date;

-- ───────────────────────────────────────────────
--  7) ATTENDANCE টেবিল (দৈনিক শ্রমিক উপস্থিতি — P/A)
-- ───────────────────────────────────────────────
create table if not exists public.attendance (
  id text primary key, -- ফরম্যাট: {worker_id}_{date}
  worker_id uuid not null,
  date date not null,
  status text not null, -- 'P' | 'A'
  created_at timestamptz default now()
);
alter table public.attendance enable row level security;

drop policy if exists "attendance_select_all" on public.attendance;
create policy "attendance_select_all" on public.attendance
  for select using (true);

drop policy if exists "attendance_insert_auth" on public.attendance;
create policy "attendance_insert_auth" on public.attendance
  for insert to authenticated with check (true);

drop policy if exists "attendance_update_auth" on public.attendance;
create policy "attendance_update_auth" on public.attendance
  for update to authenticated using (true);

drop policy if exists "attendance_delete_auth" on public.attendance;
create policy "attendance_delete_auth" on public.attendance
  for delete to authenticated using (true);

-- ───────────────────────────────────────────────
--  উল্লেখ্য: "অতিরিক্ত কর্মদিবস", রিপোর্টের অতিরিক্ত কলাম,
--  কোম্পানির নাম/ঠিকানা সেটিংস, ও কাজের বিবরণ — এই তথ্যগুলো
--  বর্তমানে শুধু ডিভাইসের লোকাল স্টোরেজে থাকে (ক্লাউডে সিঙ্ক হয় না)।
--  এগুলো মূলত রিপোর্ট/প্রিন্ট তৈরির সময়ের সহায়ক তথ্য বিধায়
--  প্রতিটির জন্য আলাদা টেবিল না বানিয়ে সরল রাখা হয়েছে।
-- ───────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
--  8) 🔒 নিরাপত্তা কড়াকড়ি (গুরুত্বপূর্ণ — চালানোর পরামর্শ দেওয়া হচ্ছে)
--
--  সমস্যা যা এখন পর্যন্ত ছিল: "কোন এডমিন শুধু নিজের বিভাগ এডিট করতে
--  পারবে" — এই নিয়ম এতদিন শুধু অ্যাপের JavaScript কোডে চেক হতো।
--  ডাটাবেজ কাউকে আটকাতো না। তার মানে, কোনো ব্যবহারকারী চাইলে ব্রাউজারের
--  Developer Tools খুলে সরাসরি Supabase-এ রিকোয়েস্ট পাঠিয়ে অন্য
--  বিভাগের তথ্য এডিট/মুছে ফেলতে পারতো — অ্যাপের বাটন-লুকানো নিয়ম
--  বাইপাস করে। এই অংশটুকু রান করলে এখন থেকে ডাটাবেজ নিজেই যাচাই
--  করবে: সুপার অ্যাডমিন সব বিভাগ এডিট করতে পারবে, কিন্তু শাখা এডমিন
--  শুধুমাত্র নিজের অনুমোদিত বিভাগের তথ্য এডিট/মুছতে পারবে — সরাসরি
--  API কল করলেও।
--
--  এটা রান করার আগে নিশ্চিত করুন ৬ ও ৭ নং অংশ (কলাম ও attendance
--  টেবিল) ইতিমধ্যে রান করা আছে।
-- ═══════════════════════════════════════════════════════════════

-- সহায়ক ফাংশন ১: এই বিভাগে (dept) লেখার অনুমতি আছে কিনা
create or replace function public.can_write_dept(target_dept text)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.status = 'approved'
      and (p.role = 'super' or (p.role = 'admin' and p.req_dept = target_dept))
  );
$$;

-- সহায়ক ফাংশন ২: এই শ্রমিকের (worker_id) attendance-এ লেখার অনুমতি আছে কিনা
create or replace function public.can_write_worker(worker uuid)
returns boolean
language sql
stable
as $$
  select exists (
    select 1 from public.profiles p
    join public.manpower m on m.id = worker
    where p.id = auth.uid()
      and p.status = 'approved'
      and (p.role = 'super' or (p.role = 'admin' and p.req_dept = m.dept))
  );
$$;

-- STOCK ITEMS
drop policy if exists "stock_items_insert_auth" on public.stock_items;
create policy "stock_items_insert_auth" on public.stock_items
  for insert to authenticated with check (public.can_write_dept(dept));
drop policy if exists "stock_items_update_auth" on public.stock_items;
create policy "stock_items_update_auth" on public.stock_items
  for update to authenticated using (public.can_write_dept(dept));
drop policy if exists "stock_items_delete_auth" on public.stock_items;
create policy "stock_items_delete_auth" on public.stock_items
  for delete to authenticated using (public.can_write_dept(dept));

-- UNLOAD LOGS
drop policy if exists "unload_logs_insert_auth" on public.unload_logs;
create policy "unload_logs_insert_auth" on public.unload_logs
  for insert to authenticated with check (public.can_write_dept(dept));
drop policy if exists "unload_logs_update_auth" on public.unload_logs;
create policy "unload_logs_update_auth" on public.unload_logs
  for update to authenticated using (public.can_write_dept(dept));
drop policy if exists "unload_logs_delete_auth" on public.unload_logs;
create policy "unload_logs_delete_auth" on public.unload_logs
  for delete to authenticated using (public.can_write_dept(dept));

-- MANPOWER
drop policy if exists "manpower_insert_auth" on public.manpower;
create policy "manpower_insert_auth" on public.manpower
  for insert to authenticated with check (public.can_write_dept(dept));
drop policy if exists "manpower_update_auth" on public.manpower;
create policy "manpower_update_auth" on public.manpower
  for update to authenticated using (public.can_write_dept(dept));
drop policy if exists "manpower_delete_auth" on public.manpower;
create policy "manpower_delete_auth" on public.manpower
  for delete to authenticated using (public.can_write_dept(dept));

-- ACTIVITIES
drop policy if exists "activities_insert_auth" on public.activities;
create policy "activities_insert_auth" on public.activities
  for insert to authenticated with check (public.can_write_dept(dept));
drop policy if exists "activities_update_auth" on public.activities;
create policy "activities_update_auth" on public.activities
  for update to authenticated using (public.can_write_dept(dept));
drop policy if exists "activities_delete_auth" on public.activities;
create policy "activities_delete_auth" on public.activities
  for delete to authenticated using (public.can_write_dept(dept));

-- ATTENDANCE (worker_id দিয়ে manpower টেবিল জয়েন করে বিভাগ যাচাই হয়)
drop policy if exists "attendance_insert_auth" on public.attendance;
create policy "attendance_insert_auth" on public.attendance
  for insert to authenticated with check (public.can_write_worker(worker_id));
drop policy if exists "attendance_update_auth" on public.attendance;
create policy "attendance_update_auth" on public.attendance
  for update to authenticated using (public.can_write_worker(worker_id));
drop policy if exists "attendance_delete_auth" on public.attendance;
create policy "attendance_delete_auth" on public.attendance
  for delete to authenticated using (public.can_write_worker(worker_id));

-- ───────────────────────────────────────────────
--  পরীক্ষা করুন: শাখা এডমিন হিসেবে লগইন করে নিজের বিভাগে যোগ/এডিট/
--  ডিলিট করে দেখুন (ঠিকভাবে কাজ করবে), তারপর অন্য বিভাগে চেষ্টা করে
--  দেখুন (এখন আটকে যাবে)। কোনো সমস্যা হলে req_dept ঠিকভাবে সেট
--  আছে কিনা প্রোফাইল টেবিলে যাচাই করুন।
-- ───────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
--  9) 🔧 ট্রাবলশুটিং: "লোকালি সেভ হচ্ছে কিন্তু ক্লাউডে হচ্ছে না"
--
--  এই সমস্যার সাথে Realtime টগল, Storage bucket, বা "messages" API
--  পলিসির কোনো সম্পর্ক নেই — ওগুলো Supabase-এর সম্পূর্ণ ভিন্ন ফিচার
--  (লাইভ পুশ-আপডেট আর ফাইল আপলোডের জন্য), এই অ্যাপ কোনোটাই ব্যবহার
--  করে না। আসল কারণ সাধারণত এই দুটোর একটা:
--
--  ক) PostgREST-এর স্কিমা ক্যাশ পুরনো — নতুন কলাম/টেবিল/ফাংশন যোগ
--     করার পর PostgREST কখনো কখনো কিছুক্ষণ সময় নেয় বুঝতে যে নতুন
--     জিনিস যোগ হয়েছে। নিচের কমান্ডটা রান করে জোর করে রিফ্রেশ করুন:
notify pgrst, 'reload schema';

--  খ) RLS পলিসি (৮ নং অংশ) আটকে দিচ্ছে — req_dept ঠিকভাবে সেট নেই।
--     নিচের কোয়েরি দিয়ে নিজের প্রোফাইল চেক করুন (নিজের ইমেইল বসান):
--
--     select id, email, role, status, dept, req_dept
--     from public.profiles
--     where email = 'আপনার-ইমেইল@example.com';
--
--     role অবশ্যই 'admin' বা 'super', status অবশ্যই 'approved', এবং
--     req_dept অবশ্যই এই মানগুলোর একটা হতে হবে (ছোট হাতের ইংরেজি):
--     field, plant, production, compressor, security, admin, electric
--     — এর বাইরে অন্য কিছু (যেমন খালি, বা ভুল বানান) থাকলে ৮ নং
--     অংশের নীতি সব লেখা আটকে দেবে।
--
--  যদি এখনো সমাধান না হয়, সাময়িকভাবে ৮ নং অংশের কড়াকড়ি বাতিল করে
--  আগের মতো খোলা নীতিতে ফিরে যেতে (শুধু সমস্যা নির্ণয়ের জন্য) নিচের
--  কমান্ড রান করুন, তারপর আবার চেষ্টা করে দেখুন কাজ করে কিনা:
--
--  drop policy if exists "manpower_insert_auth" on public.manpower;
--  create policy "manpower_insert_auth" on public.manpower
--    for insert to authenticated with check (true);
--
--  এটা কাজ করলে বুঝবেন সমস্যা RLS নীতিতে (req_dept মিসম্যাচ), আর
--  কাজ না করলে বুঝবেন সমস্যা অন্য কোথাও (স্কিমা ক্যাশ বা auth টোকেন)।
--  সমাধান হয়ে গেলে আবার ৮ নং অংশ রান করে কড়াকড়ি ফিরিয়ে আনুন।
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
--  ⚠️⚠️⚠️ এই অংশ (১০) আর রান করবেন না — এটা ভুল দিক নির্ণয়ের
--  ভিত্তিতে বানানো, এবং বর্তমান অ্যাপ কোডের (index.html) সাথে
--  সাংঘর্ষিক। বর্তমান অ্যাপ কোড সবসময় snake_case নামে ডেটা পাঠায়
--  (cl_last_date, other_leave_last_date, al_taken, al_date) —
--  camelCase (alTaken, clLastDate ইত্যাদি) কখনোই পাঠায় না।
--
--  এই অংশ যদি ইতিমধ্যে রান করা হয়ে থাকে (কলামগুলো এখন camelCase-এ
--  আছে), তাহলে নিচে ১২ নং অংশ রান করুন — সেটা কলামগুলো আবার সঠিক
--  snake_case-এ ফিরিয়ে আনবে (এখনো camelCase-এ রান না করা থাকলেও
--  ১২ নং অংশ নিরাপদে/idempotent-ভাবে কাজ করবে, কোনো ক্ষতি হবে না)।
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='cl_last_date') then
    alter table public.manpower rename column cl_last_date to "clLastDate";
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='cl_remaining') then
    alter table public.manpower rename column cl_remaining to "clRemaining";
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='other_leave_last_date') then
    alter table public.manpower rename column other_leave_last_date to "otherLeaveLastDate";
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='other_leave_remaining') then
    alter table public.manpower rename column other_leave_remaining to "otherLeaveRemaining";
  end if;
  if exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='al_taken') then
    alter table public.manpower rename column al_taken to "alTaken";
  end if;
end $$;

-- এই কমান্ডটা রান করে PostgREST-কে জানিয়ে দিন যে স্কিমা বদলেছে
notify pgrst, 'reload schema';
-- ═══════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════
--  11) ⚡ REALTIME চালু করা (এক ডিভাইসে পরিবর্তন হলেই সব জায়গায়
--      সাথে সাথে আপডেট হবে — কোনো ম্যানুয়াল রিফ্রেশ লাগবে না)
--
--  Supabase Dashboard → Database → Replication (বা Database Table
--  ভিউতে প্রতিটা টেবিলের পাশে যে "Realtime" টগল আছে) থেকে ম্যানুয়ালি
--  অন করার বদলে, নিচের কমান্ডগুলো একসাথে রান করলেই ৫টা টেবিলেই
--  Realtime চালু হয়ে যাবে। প্রতিটা "if not exists" চেক করে রান হয়,
--  তাই বারবার রান করলেও এরর দেবে না।
-- ═══════════════════════════════════════════════════════════════
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='stock_items'
  ) then
    alter publication supabase_realtime add table public.stock_items;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='unload_logs'
  ) then
    alter publication supabase_realtime add table public.unload_logs;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='manpower'
  ) then
    alter publication supabase_realtime add table public.manpower;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='activities'
  ) then
    alter publication supabase_realtime add table public.activities;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
end $$;

-- ───────────────────────────────────────────────
--  যাচাই করুন কোন কোন টেবিলে Realtime চালু আছে:
--
--  select schemaname, tablename from pg_publication_tables
--  where pubname = 'supabase_realtime';
--
--  ৫টা টেবিলই (stock_items, unload_logs, manpower, activities,
--  attendance) তালিকায় দেখা উচিত। Supabase Dashboard → Database →
--  Replication পেজে গেলেও এখন এই ৫টার পাশে টগল "ON" দেখাবে।
-- ───────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
--  12) 🎯 চূড়ান্ত ফিক্স — manpower কলামের নাম নিশ্চিতভাবে snake_case
--      (index.html যা পাঠায় তার সাথে হুবহু মিলিয়ে)
--
--  কেন এই অংশটা দরকার: ১০ নং অংশ (উপরে, এখন বাতিল/⚠️ চিহ্নিত) যদি
--  কখনো রান করা হয়ে থাকে, তাহলে DB-এর কলাম camelCase হয়ে গেছে
--  ("clLastDate", "otherLeaveLastDate", "alTaken" ইত্যাদি), অথচ
--  index.html সবসময় snake_case পাঠায়/পড়ে (cl_last_date,
--  other_leave_last_date, al_taken, al_date) — ফলে সিঙ্ক ব্যর্থ হয়
--  ("Could not find the '...' column" এরর)। আবার ৬ নং অংশে তৈরি
--  "alDate" কলামটা শুরু থেকেই camelCase, কিন্তু অ্যাপ পাঠায় al_date
--  (snake_case) — এটাও কখনো মেলেনি, তাই AL-এর তারিখ কোনোদিন cloud-এ
--  সিঙ্ক হয়নি।
--
--  এই স্ক্রিপ্টটা সম্পূর্ণ idempotent, দ্বিমুখী-নিরাপদ, এবং এখন
--  "দুইটা কলামই (camelCase ও snake_case) একসাথে আগে থেকে আছে" এই
--  অবস্থাতেও নিরাপদ — সেক্ষেত্রে camelCase কলামের ডেটা snake_case
--  কলামে কপি করে camelCase কলামটা drop করে দেবে (কোনো ডেটা হারাবে
--  না)। কোনো ডেটা মুছে না — শুধু কলামের নাম/সংখ্যা ঠিক করে।
-- ═══════════════════════════════════════════════════════════════
do $$
declare
  pairs text[][] := array[
    array['clLastDate','cl_last_date'],
    array['clRemaining','cl_remaining'],
    array['otherLeaveLastDate','other_leave_last_date'],
    array['otherLeaveRemaining','other_leave_remaining'],
    array['alTaken','al_taken'],
    array['alDate','al_date']
  ];
  p text[];
  camel_exists boolean;
  snake_exists boolean;
begin
  foreach p slice 1 in array pairs loop
    camel_exists := exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name=p[1]);
    snake_exists := exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name=p[2]);

    if camel_exists and snake_exists then
      -- দুইটা কলামই আছে — camelCase-এর ডেটা snake_case-এ কপি করে camelCase ফেলে দেয়া হচ্ছে
      execute format('update public.manpower set %I = coalesce(%I, %I)', p[2], p[2], p[1]);
      execute format('alter table public.manpower drop column %I', p[1]);
    elsif camel_exists and not snake_exists then
      -- শুধু camelCase আছে — সরাসরি rename
      execute format('alter table public.manpower rename column %I to %I', p[1], p[2]);
    end if;
    -- দুইটার একটাও camelCase নেই (snake_case ছিল বা both missing) হলে কিছু করার দরকার নেই
  end loop;

  -- al_date কলামটা কোনোভাবেই (camelCase বা snake_case) একদমই না থাকলে
  -- (একদম নতুন প্রজেক্টে) সরাসরি সঠিক নামে তৈরি করে দেয়া হচ্ছে
  if not exists (select 1 from information_schema.columns where table_schema='public' and table_name='manpower' and column_name='al_date') then
    alter table public.manpower add column al_date date;
  end if;
end $$;

-- কলামের নাম বদলানোর পর PostgREST-কে অবশ্যই জানাতে হবে যে স্কিমা বদলেছে,
-- নাহলে পুরনো (ক্যাশড) স্কিমা দিয়েই রিকোয়েস্ট প্রসেস করার চেষ্টা করবে
notify pgrst, 'reload schema';

-- ───────────────────────────────────────────────
--  যাচাই করুন কলামগুলো এখন ঠিক আছে কিনা:
--
--  select column_name, data_type from information_schema.columns
--  where table_schema='public' and table_name='manpower'
--  order by ordinal_position;
--
--  cl_last_date, cl_remaining, other_leave_last_date,
--  other_leave_remaining, al_taken, al_date — এই ৬টা নাম (ছোট হাতের,
--  আন্ডারস্কোরসহ) snake_case-এ দেখা উচিত, camelCase/quoted নামে না।
-- ───────────────────────────────────────────────

-- ═══════════════════════════════════════════════════════════════
--  ১৩) 🛡️ এক্সট্রা সুরক্ষা (ঐচ্ছিক): "date" কলামগুলোতে খালি স্ট্রিং
--      ('') কখনো পৌঁছালে সাথে সাথে বোঝা যাবে (Postgres নিজেই আটকাবে,
--      যেহেতু '' কোনোভাবেই date টাইপে কাস্ট হয় না — এটাই আসল এররের
--      উৎস ছিল)। index.html-এর supa() ফাংশনে এখন client-side-এ
--      sanitizeForSupabase() যোগ করা হয়েছে যা '' কে পাঠানোর আগেই
--      null বানিয়ে দেয় — তাই এই এরর ভবিষ্যতে আর হওয়ার কথা না।
--      এই SQL অংশে আলাদা কিছু করার দরকার নেই, শুধু মনে রাখার নোট।
-- ═══════════════════════════════════════════════════════════════
