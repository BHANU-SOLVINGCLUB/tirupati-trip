-- Auth-enabled schema for Tirupati Trip app
-- Tables: profiles, board_items, board_statuses, timelines, expenses, budgets, media_folders, media_files, checklists, checklist_items, checklist_assignments

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamp with time zone default now()
);

create table if not exists public.board_statuses (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  position integer not null default 0,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.board_items (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status_id uuid references public.board_statuses(id) on delete set null,
  due_date date,
  user_id uuid references auth.users(id) on delete cascade,
  created_at timestamptz default now()
);

create table if not exists public.timelines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  content text not null,
  happened_at timestamptz not null default now(),
  created_at timestamptz default now()
);

create table if not exists public.budgets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  title text not null,
  amount numeric not null,
  currency text default 'INR',
  created_at timestamptz default now()
);

create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  budget_id uuid references public.budgets(id) on delete set null,
  title text not null,
  amount numeric not null,
  paid_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table if not exists public.media_folders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  parent_id uuid references public.media_folders(id) on delete cascade,
  public_share_id uuid unique,
  created_at timestamptz default now()
);

create table if not exists public.media_files (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  folder_id uuid references public.media_folders(id) on delete cascade,
  name text not null,
  storage_path text not null,
  size_bytes bigint,
  mime_type text,
  public_share_id uuid unique,
  created_at timestamptz default now()
);

create table if not exists public.checklists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  user_id uuid references auth.users(id) on delete cascade,
  is_global boolean default false,
  created_at timestamptz default now()
);

create table if not exists public.checklist_items (
  id uuid primary key default gen_random_uuid(),
  checklist_id uuid references public.checklists(id) on delete cascade,
  title text not null,
  position integer default 0,
  created_at timestamptz default now()
);

create table if not exists public.checklist_assignments (
  id uuid primary key default gen_random_uuid(),
  checklist_item_id uuid references public.checklist_items(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  done boolean default false,
  created_at timestamptz default now()
);

-- Share collections (avoid writing tokens on original rows)
create table if not exists public.shares (
  token uuid primary key,
  created_at timestamptz default now()
);

create table if not exists public.share_items (
  id uuid primary key default gen_random_uuid(),
  token uuid references public.shares(token) on delete cascade,
  file_id uuid references public.media_files(id) on delete cascade,
  folder_id uuid references public.media_folders(id) on delete cascade
);

-- RLS
alter table public.profiles enable row level security;
alter table public.board_statuses enable row level security;
alter table public.board_items enable row level security;
alter table public.timelines enable row level security;
alter table public.budgets enable row level security;
alter table public.expenses enable row level security;
alter table public.media_folders enable row level security;
alter table public.media_files enable row level security;
alter table public.checklists enable row level security;
alter table public.checklist_items enable row level security;
alter table public.checklist_assignments enable row level security;
alter table public.shares enable row level security;
alter table public.share_items enable row level security;

create policy "Users can manage own profile" on public.profiles
  for all using (id = auth.uid()) with check (id = auth.uid());

create policy "Own rows" on public.board_statuses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own rows" on public.board_items for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own rows" on public.timelines for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own rows" on public.budgets for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own rows" on public.expenses for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own rows" on public.media_folders for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own rows" on public.media_files for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "Own rows" on public.checklists for all
  using (user_id = auth.uid() or is_global) with check (user_id = auth.uid());
create policy "Readable global items" on public.checklists for select
  using (is_global or user_id = auth.uid());
create policy "Readable items of visible checklists" on public.checklist_items for select
  using (exists(select 1 from public.checklists c where c.id = checklist_id and (c.is_global or c.user_id = auth.uid())));
create policy "Own assignment rows" on public.checklist_assignments for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Shares: readable by anyone (public), write by authenticated
create policy "Shares readable" on public.shares for select using (true);
create policy "Shares writable" on public.shares for all to authenticated using (true) with check (true);
create policy "Share items readable" on public.share_items for select using (true);
create policy "Share items writable" on public.share_items for all to authenticated using (true) with check (true);


