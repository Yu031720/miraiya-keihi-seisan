-- レシート写真の保存対応

alter table other_expenses add column receipt_path text;

-- Storage: "receipts" バケットは Supabase ダッシュボード(Storage画面)で
-- 作成してください(private バケット)。バケット作成後、以下のポリシーを実行します。
-- パスは "{staff_id}/{filename}" の形式を前提とし、staff_id フォルダ配下のみ
-- 本人がアクセスできるようにします。

create policy "staff can upload own receipts"
  on storage.objects for insert
  with check (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff can view own receipts"
  on storage.objects for select
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "staff can delete own receipts"
  on storage.objects for delete
  using (
    bucket_id = 'receipts'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
