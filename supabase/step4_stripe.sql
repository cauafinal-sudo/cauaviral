-- Cauã Viral · Etapa 4 Stripe (migration incremental e idempotente)
-- Execute no SQL Editor do projeto Supabase existente, depois de schema.sql + step3.sql.
create extension if not exists pgcrypto;

-- Catálogo com preços definitivos (BRL). O serviço de orçamento personalizado não cobra online.
insert into public.service_catalog(slug,service_name,service_type,amount,active) values
 ('video-transformacao','Vídeo transformação com IA','video',39.99,true),
 ('ensaio-5-fotos','Ensaio fotográfico com IA — 5 fotos','photo',19.90,true),
 ('ensaio-10-fotos','Ensaio fotográfico com IA — 10 fotos','photo',29.90,true),
 ('restauracao-de-fotos','Restauração de fotos (por imagem)','restoration',9.90,true),
 ('foto-personalizada','Foto personalizada','custom_image',14.90,true),
 ('animacao-de-foto','Animação de foto','animation',24.90,true)
on conflict (slug) do update set service_name=excluded.service_name,service_type=excluded.service_type,amount=excluded.amount,active=excluded.active,updated_at=now();

alter table public.orders add column if not exists quantity integer not null default 1 check (quantity between 1 and 100);
alter table public.orders add column if not exists stripe_checkout_session_id text;
alter table public.orders add column if not exists stripe_payment_intent_id text;
alter table public.orders add column if not exists paid_at timestamptz;
create unique index if not exists orders_stripe_session_uidx on public.orders(stripe_checkout_session_id) where stripe_checkout_session_id is not null;

-- Redefine trigger to use authoritative catalog pricing × quantity.
create or replace function public.prepare_order()
returns trigger language plpgsql security definer set search_path=public
as $$ declare catalog_row public.service_catalog%rowtype;
begin
 select * into catalog_row from public.service_catalog where slug=new.service_slug and active=true;
 if not found then raise exception 'service is unavailable'; end if;
 new.quantity=case when new.service_slug='restauracao-de-fotos' then greatest(1,least(coalesce(new.quantity,1),100)) else 1 end;
 new.service_name=catalog_row.service_name; new.service_type=catalog_row.service_type;
 new.amount=catalog_row.amount * new.quantity;
 new.payment_status='pending'; new.production_status='pending';
 return new;
end $$;

-- Payment attempts / transaction history. Amounts are integer cents, currency is ISO code.
create table if not exists public.stripe_payments (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 user_id uuid not null references public.profiles(id) on delete cascade,
 attempt integer not null,
 provider text not null default 'stripe' check(provider='stripe'),
 status text not null default 'creating' check(status in ('creating','checkout_pending','pending','paid','failed','cancelled','refunded','partially_refunded')),
 currency text not null default 'brl' check(currency='brl'),
 amount_total bigint not null check(amount_total>=0),
 amount_refunded bigint not null default 0 check(amount_refunded>=0),
 stripe_checkout_session_id text unique,
 stripe_payment_intent_id text unique,
 checkout_url text,
 idempotency_key text not null unique,
 failure_reason text,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 paid_at timestamptz,
 unique(order_id,attempt)
);
create index if not exists stripe_payments_order_idx on public.stripe_payments(order_id,created_at desc);
create index if not exists stripe_payments_status_idx on public.stripe_payments(status,paid_at desc);

create table if not exists public.stripe_webhook_events (
 event_id text primary key,
 event_type text not null,
 payload jsonb not null,
 received_at timestamptz not null default now(),
 processed_at timestamptz,
 last_error text
);

create table if not exists public.order_audit_log (
 id uuid primary key default gen_random_uuid(),
 order_id uuid not null references public.orders(id) on delete cascade,
 actor_id uuid references public.profiles(id) on delete set null,
 source text not null default 'user',
 action text not null,
 old_values jsonb,
 new_values jsonb,
 created_at timestamptz not null default now()
);
create index if not exists order_audit_log_order_idx on public.order_audit_log(order_id,created_at desc);

-- Edge Function only may reserve an attempt; concurrent requests reuse an in-progress reservation.
create or replace function public.reserve_stripe_attempt(p_order_id uuid)
returns table(attempt_no integer,payment_row_id uuid,idempotency_key text)
language plpgsql security definer set search_path=public
as $$ declare o public.orders%rowtype; p public.stripe_payments%rowtype; next_attempt integer;
begin
 if coalesce(auth.role(),'') <> 'service_role' then raise exception 'service role required'; end if;
 select * into o from public.orders where id=p_order_id for update;
 if not found then raise exception 'order not found'; end if;
 if o.payment_status='paid' then raise exception 'order already paid'; end if;
 select * into p from public.stripe_payments where order_id=p_order_id order by attempt desc limit 1;
 if found and p.status='creating' and p.stripe_checkout_session_id is null and p.created_at>now()-interval '10 minutes' then
   return query select p.attempt,p.id,p.idempotency_key; return;
 end if;
 if found and p.status in ('checkout_pending','pending') and p.checkout_url is not null and p.updated_at>now()-interval '30 minutes' then
   -- The Edge Function checks Stripe session state before using a reservation. This prevents
   -- simultaneous client requests from creating parallel sessions while the first is active.
   return query select p.attempt,p.id,p.idempotency_key; return;
 end if;
 select coalesce(max(attempt),0)+1 into next_attempt from public.stripe_payments where order_id=p_order_id;
 insert into public.stripe_payments(order_id,user_id,attempt,status,currency,amount_total,idempotency_key)
 values(o.id,o.user_id,next_attempt,'creating','brl',round(o.amount*100)::bigint,'caua-viral-order-'||o.id||'-attempt-'||next_attempt)
 returning * into p;
 return query select p.attempt,p.id,p.idempotency_key;
end $$;
revoke all on function public.reserve_stripe_attempt(uuid) from public,anon,authenticated;
grant execute on function public.reserve_stripe_attempt(uuid) to service_role;

alter table public.stripe_payments enable row level security;
alter table public.stripe_webhook_events enable row level security;
alter table public.order_audit_log enable row level security;
revoke all on public.stripe_payments from anon,authenticated;
grant select on public.stripe_payments to authenticated;
grant all on public.stripe_payments,public.stripe_webhook_events,public.order_audit_log to service_role;
revoke all on public.stripe_webhook_events from anon,authenticated;
revoke all on public.order_audit_log from anon,authenticated;
grant select on public.order_audit_log to authenticated;
drop policy if exists "payments read own or admin" on public.stripe_payments;
create policy "payments read own or admin" on public.stripe_payments for select to authenticated using(user_id=auth.uid() or public.is_admin());
drop policy if exists "audit log admin read" on public.order_audit_log;
create policy "audit log admin read" on public.order_audit_log for select to authenticated using(public.is_admin());

-- Authenticated clients cannot change payment status. Webhook/service role does so server-side.
create or replace function public.protect_order_payment_fields()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 if coalesce(auth.role(),'')='authenticated' and (
   new.payment_status is distinct from old.payment_status or
   new.amount is distinct from old.amount or
   new.stripe_checkout_session_id is distinct from old.stripe_checkout_session_id or
   new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id or
   new.paid_at is distinct from old.paid_at
 ) then raise exception 'payment fields are server managed'; end if;
 return new;
end $$;
drop trigger if exists protect_order_payment_fields on public.orders;
create trigger protect_order_payment_fields before update on public.orders for each row execute function public.protect_order_payment_fields();

create or replace function public.log_order_changes()
returns trigger language plpgsql security definer set search_path=public
as $$ declare actor uuid; src text; oldj jsonb; newj jsonb; action_name text;
begin
 actor=auth.uid(); src=case when coalesce(auth.role(),'')='service_role' then 'stripe_webhook' when actor is null then 'database' else 'user' end;
 if tg_op='INSERT' then
   action_name='order_created'; oldj=null; newj=jsonb_build_object('service_slug',new.service_slug,'amount',new.amount,'quantity',new.quantity,'payment_status',new.payment_status,'production_status',new.production_status);
 else
   oldj=jsonb_build_object('payment_status',old.payment_status,'production_status',old.production_status,'amount',old.amount);
   newj=jsonb_build_object('payment_status',new.payment_status,'production_status',new.production_status,'amount',new.amount);
   if old.payment_status is distinct from new.payment_status then action_name='payment_status_changed';
   elsif old.production_status is distinct from new.production_status then action_name='production_status_changed';
   else action_name='order_updated'; end if;
 end if;
 if tg_op='INSERT' or old.payment_status is distinct from new.payment_status or old.production_status is distinct from new.production_status then
   insert into public.order_audit_log(order_id,actor_id,source,action,old_values,new_values) values(new.id,actor,src,action_name,oldj,newj);
 end if;
 return new;
end $$;
drop trigger if exists order_audit_changes on public.orders;
create trigger order_audit_changes after insert or update on public.orders for each row execute function public.log_order_changes();

-- Chat/storage policies from step 3 remain payment gated. This migration keeps them as-is.
