-- LINE Webhookからの買取自動取り込み対応

alter table purchases add column line_message_id text unique;

create table line_webhook_events (
  id uuid primary key default gen_random_uuid(),
  line_message_id text,
  line_group_id text,
  raw_payload jsonb not null,
  parse_status text not null check (parse_status in ('parsed', 'needs_review', 'ignored')),
  parsed_staff_name text,
  resulting_purchase_id uuid references purchases(id) on delete set null,
  received_at timestamptz not null default now()
);

-- Webhookはservice roleで書き込むため、通常のスタッフ向けRLSは不要(service roleはRLSをバイパスする)
alter table line_webhook_events enable row level security;
