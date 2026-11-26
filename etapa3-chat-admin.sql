-- Cauã Viral | Etapa 3: chat privado, Storage, painel e notificações.
-- Execute DEPOIS de supabase/schema.sql no SQL Editor.
create extension if not exists pgcrypto;

-- Mantém compatibilidade com a tabela order_messages criada na etapa anterior.
alter table public.order_messages add column if not exists read_at timestamptz;
alter table public.order_messages alter column body set default '';
alter table public.order_attachments add column if not exists message_id uuid references public.order_messages(id) on delete set null;
alter table public.order_attachments add column if not exists bucket_id text not null default 'client-uploads';

create table if not exists public.admin_notifications (
 id uuid primary key default gen_random_uuid(),
 order_id uuid references public.orders(id) on delete cascade,
 kind text not null check(kind in ('paid_order','customer_message','new_file','awaiting_service','delivered')),
 title text not null,
 body text not null default '',
 created_at timestamptz not null default now(),
 read_at timestamptz
);
create index if not exists admin_notifications_created_idx on public.admin_notifications(created_at desc);
alter table public.admin_notifications enable row level security;
grant select, update on public.admin_notifications to authenticated;
grant insert on public.order_messages, public.order_attachments to authenticated;
grant update(read_at) on public.order_messages to authenticated;
drop policy if exists "admin notifications only" on public.admin_notifications;
create policy "admin notifications only" on public.admin_notifications for select to authenticated using(public.is_admin());
drop policy if exists "admin mark notifications read" on public.admin_notifications;
create policy "admin mark notifications read" on public.admin_notifications for update to authenticated using(public.is_admin()) with check(public.is_admin());

-- Clientes só podem ler mensagens de pedidos próprios pagos; administradores leem qualquer pedido.
drop policy if exists "messages read order owner or admin" on public.order_messages;
create policy "messages read paid order owner or admin" on public.order_messages for select to authenticated
using(exists(select 1 from public.orders o where o.id=order_id and (public.is_admin() or (o.user_id=auth.uid() and o.payment_status='paid'))));
drop policy if exists "messages insert paid order owner or admin" on public.order_messages;
create policy "messages insert paid order owner or admin" on public.order_messages for insert to authenticated
with check(sender_id=auth.uid() and exists(select 1 from public.orders o where o.id=order_id and (public.is_admin() or (o.user_id=auth.uid() and o.payment_status='paid'))));
drop policy if exists "messages update own read marker" on public.order_messages;
create policy "messages update own read marker" on public.order_messages for update to authenticated
using(public.is_admin() or sender_id<>auth.uid())
with check(public.is_admin() or sender_id<>auth.uid());

drop policy if exists "attachments read order owner or admin" on public.order_attachments;
create policy "attachments read paid order owner or admin" on public.order_attachments for select to authenticated
using(exists(select 1 from public.orders o where o.id=order_id and (public.is_admin() or (o.user_id=auth.uid() and o.payment_status='paid'))));
drop policy if exists "attachments insert paid order owner or admin" on public.order_attachments;
create policy "attachments insert paid order owner or admin" on public.order_attachments for insert to authenticated
with check(owner_id=auth.uid() and (
 (bucket_id='client-uploads' and exists(select 1 from public.orders o where o.id=order_id and o.user_id=auth.uid() and o.payment_status='paid'))
 or (bucket_id in ('production-files','final-deliveries') and public.is_admin())
));

-- O proprietário de um pedido nunca pode alterar payment_status, amount ou produção.
-- A política de UPDATE já é exclusiva do admin; o trigger também protege os campos críticos.
create or replace function public.protect_order_fields()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if auth.uid() is not null and not public.is_admin() then
   if new.payment_status is distinct from old.payment_status then raise exception 'payment_status is managed by the payment provider'; end if;
   if new.amount is distinct from old.amount then raise exception 'amount cannot be changed'; end if;
   if new.production_status is distinct from old.production_status then raise exception 'production_status is managed by admin'; end if;
   if new.user_id is distinct from old.user_id then raise exception 'order owner cannot be changed'; end if;
 end if;
 return new;
end $$;
drop trigger if exists protect_order_fields on public.orders;
create trigger protect_order_fields before update on public.orders for each row execute function public.protect_order_fields();

-- Notificações automáticas no banco: a origem do evento é a alteração persistida, não o frontend.
create or replace function public.notify_admin_order_events()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if tg_op='INSERT' then
  return new;
 end if;
 if old.payment_status is distinct from new.payment_status and new.payment_status='paid' then
  insert into public.admin_notifications(order_id,kind,title,body)
  values(new.id,'paid_order','Novo pedido pago',new.service_name||' — pagamento confirmado.');
  insert into public.admin_notifications(order_id,kind,title,body)
  values(new.id,'awaiting_service','Pedido aguardando atendimento',new.service_name||' está pronto para iniciar.');
 end if;
 if old.production_status is distinct from new.production_status and new.production_status='review' then
  insert into public.admin_notifications(order_id,kind,title,body)
  values(new.id,'delivered','Pedido entregue',new.service_name||' foi marcado como entregue.');
 end if;
 if old.production_status is distinct from new.production_status and new.production_status='received' and new.payment_status='paid' then
  insert into public.admin_notifications(order_id,kind,title,body)
  values(new.id,'awaiting_service','Pedido aguardando atendimento',new.service_name||' está pronto para iniciar.');
 end if;
 return new;
end $$;
drop trigger if exists orders_admin_notifications on public.orders;
create trigger orders_admin_notifications after insert or update on public.orders for each row execute function public.notify_admin_order_events();

create or replace function public.notify_admin_message()
returns trigger language plpgsql security definer set search_path=public
as $$
declare is_customer boolean;
begin
 select (p.role='customer') into is_customer from public.profiles p where p.id=new.sender_id;
 if coalesce(is_customer,false) then
  insert into public.admin_notifications(order_id,kind,title,body)
  values(new.order_id,'customer_message','Nova mensagem do cliente',left(new.body,180));
 end if;
 return new;
end $$;
drop trigger if exists order_message_admin_notification on public.order_messages;
create trigger order_message_admin_notification after insert on public.order_messages for each row execute function public.notify_admin_message();

create or replace function public.notify_admin_attachment()
returns trigger language plpgsql security definer set search_path=public
as $$
begin
 if exists(select 1 from public.profiles p where p.id=new.owner_id and p.role='customer') then
  insert into public.admin_notifications(order_id,kind,title,body)
  values(new.order_id,'new_file','Novo arquivo recebido',new.original_name);
 end if;
 return new;
end $$;
drop trigger if exists order_attachment_admin_notification on public.order_attachments;
create trigger order_attachment_admin_notification after insert on public.order_attachments for each row execute function public.notify_admin_attachment();

-- Buckets privados. Limite inicial 512 MiB por arquivo; ajuste conforme plano e necessidade.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values
 ('client-uploads','client-uploads',false,536870912,array['image/jpeg','image/png','image/webp','image/gif','video/mp4','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm','application/pdf','text/plain','application/zip','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']),
 ('production-files','production-files',false,536870912,null),
 ('final-deliveries','final-deliveries',false,536870912,null)
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

-- O primeiro diretório do objeto é o UUID do pedido. Storage aplica autorização no banco.
drop policy if exists "private order storage read" on storage.objects;
create policy "private order storage read" on storage.objects for select to authenticated
using(bucket_id in ('client-uploads','production-files','final-deliveries') and exists(
 select 1 from public.orders o where o.id::text=(storage.foldername(name))[1]
 and (public.is_admin() or (o.user_id=auth.uid() and o.payment_status='paid'))
));
drop policy if exists "private client upload" on storage.objects;
create policy "private client upload" on storage.objects for insert to authenticated
with check(bucket_id='client-uploads' and exists(
 select 1 from public.orders o where o.id::text=(storage.foldername(name))[1]
 and o.user_id=auth.uid() and o.payment_status='paid'
));
drop policy if exists "admin production upload" on storage.objects;
create policy "admin production upload" on storage.objects for insert to authenticated
with check(bucket_id in ('production-files','final-deliveries') and public.is_admin() and exists(
 select 1 from public.orders o where o.id::text=(storage.foldername(name))[1]
));
drop policy if exists "admin storage update" on storage.objects;
create policy "admin storage update" on storage.objects for update to authenticated using(public.is_admin() and bucket_id in ('client-uploads','production-files','final-deliveries')) with check(public.is_admin());
drop policy if exists "admin storage delete" on storage.objects;
create policy "admin storage delete" on storage.objects for delete to authenticated using(public.is_admin() and bucket_id in ('client-uploads','production-files','final-deliveries'));

-- Realtime: habilita eventos para conversas e status dos pedidos.
do $$ begin
 alter publication supabase_realtime add table public.order_messages;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.order_attachments;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.orders;
exception when duplicate_object then null; when others then null; end $$;
do $$ begin
 alter publication supabase_realtime add table public.admin_notifications;
exception when duplicate_object then null; when others then null; end $$;


-- Agregações no banco evitam métricas incorretas pelo limite de paginação da API.
create or replace function public.admin_dashboard_metrics()
returns table(
 total_revenue numeric,
 monthly_revenue numeric,
 total_orders bigint,
 pending_orders bigint,
 in_progress_orders bigint,
 delivered_orders bigint,
 completed_orders bigint,
 customer_count bigint,
 awaiting_service_orders bigint
)
language plpgsql stable security definer set search_path=public
as $$
begin
 if not public.is_admin() then raise exception 'admin access required'; end if;
 return query
 select
  coalesce(sum(o.amount) filter(where o.payment_status='paid'),0)::numeric,
  coalesce(sum(o.amount) filter(where o.payment_status='paid' and o.created_at>=date_trunc('month',now())),0)::numeric,
  count(*)::bigint,
  count(*) filter(where o.payment_status='pending')::bigint,
  count(*) filter(where o.production_status='in_progress')::bigint,
  count(*) filter(where o.production_status='review')::bigint,
  count(*) filter(where o.production_status='completed')::bigint,
  (select count(*) from public.profiles p where p.role='customer')::bigint,
  count(*) filter(where o.payment_status='paid' and o.production_status='received')::bigint
 from public.orders o;
end $$;
revoke all on function public.admin_dashboard_metrics() from public;
grant execute on function public.admin_dashboard_metrics() to authenticated;
