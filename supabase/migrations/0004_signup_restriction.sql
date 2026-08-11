-- サインアップ制限: 招待コードを知っている人だけアカウント作成できるようにする

create table app_settings (
  key text primary key,
  value text not null
);

alter table app_settings enable row level security;
-- ポリシーを追加しないことで、anon/authenticatedロールからは一切参照・変更できない
-- (service role、および security definer 関数のみアクセス可能)

insert into app_settings (key, value) values ('signup_code', 'miraiya2026');

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
declare
  expected_code text;
begin
  select value into expected_code from public.app_settings where key = 'signup_code';

  if expected_code is not null and expected_code <> '' then
    if coalesce(new.raw_user_meta_data->>'signup_code', '') <> expected_code then
      raise exception 'invalid signup code';
    end if;
  end if;

  insert into public.staff_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
