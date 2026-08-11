-- サインアップ制限を「招待コード方式」から「メールアドレス許可リスト方式」に変更

drop table if exists app_settings;

create table allowed_signup_emails (
  email text primary key
);

alter table allowed_signup_emails enable row level security;
-- ポリシーを追加しないことで、anon/authenticatedロールからは一切参照・変更できない
-- (service role、および security definer 関数のみアクセス可能)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_signup_emails
    where lower(email) = lower(new.email)
  ) then
    raise exception 'email not allowed to sign up';
  end if;

  insert into public.staff_profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)));
  return new;
end;
$$;
