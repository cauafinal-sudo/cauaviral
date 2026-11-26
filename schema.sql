-- Cauã Viral: schema etapa 2 (execute no SQL Editor do projeto Supabase)
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '' check (length(trim(full_name)) >= 3),
  email text not null,
  phone text not null default '' check (length(trim(phone)) >= 7),
  role text not null default 'customer' check (role in ('customer','admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.service_catalog (
  slug text primary key,
  service_name text not null,
  service_type text not null,
  amount numeric(10,2) not null check (amount >= 0),
  active boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.service_catalog(slug,service_name,service_type,amount,active) values
 ('video-transformacao','Vídeo transformação com IA','video',39.99,true),
 ('ensaio-5-fotos','Ensaio fotográfico com IA — 5 fotos','photo',14.90,true),
 ('ensaio-10-fotos','Ensaio fotográfico com IA — 10 fotos','photo',24.90,true),
 ('restauracao-de-fotos','Restauração de fotos (por imagem)','restoration',9.90,true),
 ('foto-personalizada','Foto personalizada','custom_image',14.90,true),
 ('animacao-de-foto','Animação de foto','animation',24.90,true)
on conflict (slug) do update set service_name=excluded.service_name, service_type=excluded.service_type, amount=excluded.amount, active=excluded.active;

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  service_slug text not null references public.service_catalog(slug),
  service_name text not null,
  service_type text not null,
  amount numeric(10,2) not null check (amount >= 0),
  payment_status text not null default 'pending' check (payment_status in ('pending','paid','failed','refunded','cancelled')),
  production_status text not null default 'received' check (production_status in ('received','in_progress','review','completed','on_hold')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists orders_user_created_idx on public.orders(user_id, created_at desc);
create index if not exists orders_status_idx on public.orders(payment_status, production_status);

-- Estrutura reservada para próxima etapa: chat e arquivos associados aos pedidos.
create table if not exists public.order_messages (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 sender_id uuid not null references public.profiles(id) on delete cascade, body text not null,
 created_at timestamptz not null default now()
);
create index if not exists order_messages_order_idx on public.order_messages(order_id,created_at);
create table if not exists public.order_attachments (
 id uuid primary key default gen_random_uuid(), order_id uuid not null references public.orders(id) on delete cascade,
 owner_id uuid not null references public.profiles(id) on delete cascade, storage_path text not null,
 original_name text not null, mime_type text, size_bytes bigint, created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path=public
as $$ select exists(select 1 from public.profiles where id=auth.uid() and role='admin') $$;
revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated;

create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path=public
as $$ begin new.updated_at=now(); return new; end $$;
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 insert into public.profiles(id,full_name,email,phone,role)
 values(new.id,coalesce(new.raw_user_meta_data->>'full_name',''),new.email,coalesce(new.raw_user_meta_data->>'phone',''),'customer')
 on conflict(id) do update set email=excluded.email;
 return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute procedure public.handle_new_user();

-- Backfill caso haja usuários Auth criados antes da aplicação do trigger.
insert into public.profiles(id,full_name,email,phone,role)
select id,coalesce(raw_user_meta_data->>'full_name',''),email,coalesce(raw_user_meta_data->>'phone',''),'customer'
from auth.users
where email is not null and length(trim(coalesce(raw_user_meta_data->>'full_name',''))) >= 3
  and length(trim(coalesce(raw_user_meta_data->>'phone',''))) >= 7
on conflict(id) do nothing;

-- Role é imutável para o próprio usuário. Alteração exige admin ou operação privilegiada.
create or replace function public.protect_profile_role()
returns trigger language plpgsql security definer set search_path=public
as $$ begin
 if auth.uid() is not null and not public.is_admin() then
   if new.role is distinct from old.role then raise exception 'role cannot be changed by the account owner'; end if;
   if new.email is distinct from old.email then raise exception 'email must be changed through Supabase Auth'; end if;
 end if;
 return new;
end $$;
drop trigger if exists protect_profile_role on public.profiles;
create trigger protect_profile_role before update on public.profiles for each row execute procedure public.protect_profile_role();

-- O preço/nome é sempre definido pelo catálogo no banco, não pelo navegador.
create or replace function public.prepare_order()
returns trigger language plpgsql security definer set search_path=public
as $$ declare catalog_row public.service_catalog%rowtype;
begin
 select * into catalog_row from public.service_catalog where slug=new.service_slug and active=true;
 if not found then raise exception 'service is unavailable'; end if;
 new.service_name=catalog_row.service_name; new.service_type=catalog_row.service_type; new.amount=catalog_row.amount;
 new.payment_status='pending'; new.production_status='received';
 return new;
end $$;
drop trigger if exists prepare_order_before_insert on public.orders;
create trigger prepare_order_before_insert before insert on public.orders for each row execute procedure public.prepare_order();
create trigger profiles_updated_at before update on public.profiles for each row execute procedure public.set_updated_at();
create trigger orders_updated_at before update on public.orders for each row execute procedure public.set_updated_at();

alter table public.profiles enable row level security;
alter table public.service_catalog enable row level security;
alter table public.orders enable row level security;
alter table public.order_messages enable row level security;
alter table public.order_attachments enable row level security;

-- API permissions (RLS continua sendo a barreira de linha/registro).
grant select on public.service_catalog to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update on public.orders to authenticated;
grant select on public.order_messages, public.order_attachments to authenticated;

drop policy if exists "profile read own or admin" on public.profiles;
create policy "profile read own or admin" on public.profiles for select to authenticated using (id=auth.uid() or public.is_admin());
drop policy if exists "profile update own fields or admin" on public.profiles;
create policy "profile update own fields or admin" on public.profiles for update to authenticated using (id=auth.uid() or public.is_admin()) with check (id=auth.uid() or public.is_admin());
drop policy if exists "catalog public read active" on public.service_catalog;
create policy "catalog public read active" on public.service_catalog for select to anon,authenticated using (active=true or public.is_admin());
drop policy if exists "orders read own or admin" on public.orders;
create policy "orders read own or admin" on public.orders for select to authenticated using (user_id=auth.uid() or public.is_admin());
drop policy if exists "customer create own order" on public.orders;
create policy "customer create own order" on public.orders for insert to authenticated with check (user_id=auth.uid());
drop policy if exists "admin update orders" on public.orders;
create policy "admin update orders" on public.orders for update to authenticated using (public.is_admin()) with check (public.is_admin());
-- A etapa 3 habilitará as operações de chat; por ora, somente leitura para o dono/admin.
drop policy if exists "messages read order owner or admin" on public.order_messages;
create policy "messages read order owner or admin" on public.order_messages for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));
drop policy if exists "attachments read order owner or admin" on public.order_attachments;
create policy "attachments read order owner or admin" on public.order_attachments for select to authenticated using (exists(select 1 from public.orders o where o.id=order_id and (o.user_id=auth.uid() or public.is_admin())));

-- O proprietário promove a conta de administrador manualmente, no SQL Editor, usando o UUID do usuário.
-- UPDATE public.profiles SET role='admin' WHERE id='UUID-DO-PROPRIETARIO';
