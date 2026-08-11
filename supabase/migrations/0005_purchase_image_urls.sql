-- 社内アプリから届く買取の写真URLを保存できるようにする

alter table purchases add column image_urls text[];
