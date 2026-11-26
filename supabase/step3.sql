-- Cauã Viral etapa 3: chat privado, storage, administração e notificações
-- Execute depois do schema.sql da etapa 2 no Supabase SQL Editor.
create extension if not exists pgcrypto;

-- Normalize production workflow from etapa 2 to requested stages.
alter table public.orders drop constraint if exists orders_production_status_check;
update public.orders set production_status = case production_status
  when 'received' then 'pending' when 'review' then 'in_progress' when 'on_hold' then 'pending'
  when 'completed' then 'completed' else production_status end;
alter table public.orders add constraint orders_production_status_check check (production_status in ('pending','in_progress','delivered','completed'));

alter table public.order_messages alter column body set default '';
alter table public.order_messages add column if not exists edited_at timestamptz;
alter table public.order_attachments add column if not exists message_id uuid references public.order_messages(id) on delete cascade;
alter table public.order_attachments add column if not exists bucket_id text not null default 'customer-files';
alter table public.order_attachments add column if not exists category text not null default 'customer';
alter table public.order_attachments add column if not exists original_name text not null default 'arquivo';
alter table public.order_attachments add column if not exists mime_type text;
alter table public.order_attachments add column if not exists size_bytes bigint;

create table if not exists public.order_read_states (
  order_id uuid not null references public.orders(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz not null default now(),
  primary key(order_id,user_id)
);
create table if not exists public.admin_notifications (
  id uuid primary key default gen_random_uuid(),
  kind text not null check(kind in ('paid_order','customer_message','file_received','waiting_order','order_delivered')),
  order_id uuid references public.orders(id) on delete cascade,
  customer_id uuid references public.profiles(id) on delete set null,
  title text not null,
  body text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists order_messages_order_created_idx on public.order_messages(order_id,created_at desc);
create index if not exists attachments_order_idx on public.order_attachments(order_id,created_at desc);
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);

-- Admin privilege is checked server-side through profile role; never through client metadata.
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

alter table public.order_messages enable row level security;
alter table public.order_attachments enable row level security;
alter table public.order_read_states enable row level security;
alter table public.admin_notifications enable row level security;

grant select,insert on public.order_messages to authenticated;
grant select,insert on public.order_attachments to authenticated;
grant select,insert,update on public.order_read_states to authenticated;
grant select,update on public.admin_notifications to authenticated;

-- Only the owner of a paid order or admin can read chat. Inserts are similarly gated.
drop policy if exists "messages read order owner or admin" on public.order_messages;
drop policy if exists "paid order chat read" on public.order_messages;
create policy "paid order chat read" on public.order_messages for select to authenticated
using (exists(select 1 from public.orders o where o.id=order_id and o.payment_status='paid' and (o.user_id=auth.uid() or public.is_admin())));
drop policy if exists "paid order chat insert" on public.order_messages;
create policy "paid order chat insert" on public.order_messages for insert to authenticated
with check (sender_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.payment_status='paid' and (o.user_id=auth.uid() or public.is_admin())));

drop policy if exists "attachments read order owner or admin" on public.order_attachments;
drop policy if exists "paid order attachments read" on public.order_attachments;
create policy "paid order attachments read" on public.order_attachments for select to authenticated
using (exists(select 1 from public.orders o where o.id=order_id and o.payment_status='paid' and (o.user_id=auth.uid() or public.is_admin())));
drop policy if exists "paid order attachments insert" on public.order_attachments;
create policy "paid order attachments insert" on public.order_attachments for insert to authenticated
with check (owner_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.payment_status='paid' and (o.user_id=auth.uid() or public.is_admin())));

drop policy if exists "read own chat read state or admin" on public.order_read_states;
create policy "read own chat read state or admin" on public.order_read_states for select to authenticated
using (user_id=auth.uid() or public.is_admin());
drop policy if exists "write own read state paid order" on public.order_read_states;
create policy "write own read state paid order" on public.order_read_states for insert to authenticated
with check (user_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and o.payment_status='paid' and (o.user_id=auth.uid() or public.is_admin())));
drop policy if exists "update own read state" on public.order_read_states;
create policy "update own read state" on public.order_read_states for update to authenticated
using (user_id=auth.uid() or public.is_admin()) with check (user_id=auth.uid() or public.is_admin());

drop policy if exists "admin notifications admin read" on public.admin_notifications;
create policy "admin notifications admin read" on public.admin_notifications for select to authenticated using (public.is_admin());
drop policy if exists "admin notifications admin update" on public.admin_notifications;
create policy "admin notifications admin update" on public.admin_notifications for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Private buckets. Files are stored under <order-uuid>/<unique-file-name>.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values
 ('customer-files','customer-files',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/webm','audio/ogg','application/pdf']),
 ('production-files','production-files',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/webm','audio/ogg','application/pdf']),
 ('final-deliveries','final-deliveries',false,52428800,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/webm','audio/ogg','application/pdf'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- Folder path first segment is order ID. Customer uploads only into customer-files; admin may upload production/final.
drop policy if exists "private order files read paid owner or admin" on storage.objects;
create policy "private order files read paid owner or admin" on storage.objects for select to authenticated
using (bucket_id in ('customer-files','production-files','final-deliveries') and exists(
 select 1 from public.orders o where o.id=(storage.foldername(name))[1]::uuid and o.payment_status='paid' and (o.user_id=auth.uid() or public.is_admin())));
drop policy if exists "customer upload paid order" on storage.objects;
create policy "customer upload paid order" on storage.objects for insert to authenticated
with check (bucket_id='customer-files' and exists(select 1 from public.orders o where o.id=(storage.foldername(name))[1]::uuid and o.payment_status='paid' and o.user_id=auth.uid()));
drop policy if exists "admin upload production or delivery" on storage.objects;
create policy "admin upload production or delivery" on storage.objects for insert to authenticated
with check (bucket_id in ('production-files','final-deliveries') and public.is_admin() and exists(select 1 from public.orders o where o.id=(storage.foldername(name))[1]::uuid and o.payment_status='paid'));
drop policy if exists "admin delete private files" on storage.objects;
create policy "admin delete private files" on storage.objects for delete to authenticated using (bucket_id in ('customer-files','production-files','final-deliveries') and public.is_admin());

-- Admin notifications are created server-side for new paid orders (payment provider webhook in etapa 4), messages and file metadata.
create or replace function public.notify_admin_new_paid_order()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 if tg_op='INSERT' then
   if new.payment_status='paid' then
     insert into public.admin_notifications(kind,order_id,customer_id,title,body)
     values('paid_order',new.id,new.user_id,'Novo pedido pago',new.service_name||' · pedido '||left(new.id::text,8));
     if new.production_status='pending' then
       insert into public.admin_notifications(kind,order_id,customer_id,title,body)
       values('waiting_order',new.id,new.user_id,'Pedido aguardando atendimento',new.service_name||' precisa iniciar produção');
     end if;
   end if;
 elsif new.payment_status='paid' and old.payment_status is distinct from new.payment_status then
   insert into public.admin_notifications(kind,order_id,customer_id,title,body)
   values('paid_order',new.id,new.user_id,'Novo pedido pago',new.service_name||' · pedido '||left(new.id::text,8));
   if new.production_status='pending' then
     insert into public.admin_notifications(kind,order_id,customer_id,title,body)
     values('waiting_order',new.id,new.user_id,'Pedido aguardando atendimento',new.service_name||' precisa iniciar produção');
   end if;
 end if;
 return new;
end $$;
drop trigger if exists notify_paid_order on public.orders;
create trigger notify_paid_order after insert or update of payment_status on public.orders for each row execute function public.notify_admin_new_paid_order();

create or replace function public.notify_admin_chat_activity()
returns trigger language plpgsql security definer set search_path=public
as $$ declare order_row public.orders%rowtype; begin
 select * into order_row from public.orders where id=new.order_id;
 if not public.is_admin() then
   insert into public.admin_notifications(kind,order_id,customer_id,title,body)
   values('customer_message',new.order_id,order_row.user_id,'Nova mensagem do cliente',left(coalesce(new.body,'Arquivo enviado'),120));
 end if;
 return new;
end $$;
drop trigger if exists notify_chat_activity on public.order_messages;
create trigger notify_chat_activity after insert on public.order_messages for each row execute function public.notify_admin_chat_activity();

create or replace function public.notify_admin_file_received()
returns trigger language plpgsql security definer set search_path=public
as $$ declare order_row public.orders%rowtype; begin
 select * into order_row from public.orders where id=new.order_id;
 if not public.is_admin() then insert into public.admin_notifications(kind,order_id,customer_id,title,body)
 values('file_received',new.order_id,order_row.user_id,'Arquivo recebido',new.original_name); end if;
 return new; end $$;
drop trigger if exists notify_file_received on public.order_attachments;
create trigger notify_file_received after insert on public.order_attachments for each row execute function public.notify_admin_file_received();

-- Status changes to delivered notify the customer via the app's order realtime feed.
create or replace function public.notify_order_delivered()
returns trigger language plpgsql security definer set search_path=public
as $$ begin if new.production_status='delivered' and old.production_status is distinct from new.production_status then
 insert into public.admin_notifications(kind,order_id,customer_id,title,body) values('order_delivered',new.id,new.user_id,'Pedido entregue',new.service_name||' marcado como entregue');
end if; return new; end $$;
drop trigger if exists notify_order_delivered on public.orders;
create trigger notify_order_delivered after update of production_status on public.orders for each row execute function public.notify_order_delivered();

-- Enable Realtime for order messages and orders.
do $$ begin
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='order_messages') then alter publication supabase_realtime add table public.order_messages; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='orders') then alter publication supabase_realtime add table public.orders; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='admin_notifications') then alter publication supabase_realtime add table public.admin_notifications; end if;
 if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='order_attachments') then alter publication supabase_realtime add table public.order_attachments; end if;
end $$;
