-- みらいや経費精算 初期スキーマ (フェーズ1: 手入力のみ)

create table staff_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table report_periods (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  period_start date not null,
  period_end date not null,
  starting_float integer not null default 0,
  transfer_base integer not null default 300000,
  transfer_manual_addition integer not null default 0,
  status text not null default 'draft' check (status in ('draft', 'finalized')),
  computed_zangaku integer,
  generated_text text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table purchases (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  report_period_id uuid references report_periods(id) on delete set null,
  amount integer not null check (amount >= 0),
  category text,
  item_note text,
  source text not null default 'manual' check (source in ('manual', 'line')),
  occurred_at date not null default current_date,
  needs_review boolean not null default false,
  created_at timestamptz not null default now()
);

create table other_expenses (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references staff_profiles(id) on delete cascade,
  report_period_id uuid references report_periods(id) on delete set null,
  amount integer not null check (amount >= 0),
  description text not null,
  expense_date date not null default current_date,
  created_at timestamptz not null default now()
);

create index on report_periods (staff_id, period_start desc);
create index on purchases (report_period_id);
create index on other_expenses (report_period_id);

-- 新規サインアップ時に staff_profiles を自動作成 (display_name はメールのローカル部を仮の値に)
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.staff_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- Row Level Security: 各スタッフは自分のデータのみ
alter table staff_profiles enable row level security;
alter table report_periods enable row level security;
alter table purchases enable row level security;
alter table other_expenses enable row level security;

create policy "staff can view own profile" on staff_profiles
  for select using (auth.uid() = id);
create policy "staff can update own profile" on staff_profiles
  for update using (auth.uid() = id);

create policy "staff manage own report_periods" on report_periods
  for all using (auth.uid() = staff_id) with check (auth.uid() = staff_id);

create policy "staff manage own purchases" on purchases
  for all using (auth.uid() = staff_id) with check (auth.uid() = staff_id);

create policy "staff manage own other_expenses" on other_expenses
  for all using (auth.uid() = staff_id) with check (auth.uid() = staff_id);
