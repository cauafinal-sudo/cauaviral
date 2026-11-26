-- Cauã Viral: quantidade em todos os serviços pagos
-- Execute no SQL Editor do Supabase após a migração step4_stripe.sql.
-- O projeto personalizado continua sendo orçamento via WhatsApp e não gera checkout.
create or replace function public.prepare_order()
returns trigger
language plpgsql
security definer
set search_path=public
as $$
declare
  catalog_row public.service_catalog%rowtype;
begin
  select * into catalog_row
  from public.service_catalog
  where slug = new.service_slug and active = true;

  if not found then
    raise exception 'service is unavailable';
  end if;

  new.quantity = greatest(1, least(coalesce(new.quantity, 1), 100));
  new.service_name = catalog_row.service_name;
  new.service_type = catalog_row.service_type;
  new.amount = catalog_row.amount * new.quantity;
  new.payment_status = 'pending';
  new.production_status = 'received';
  return new;
end;
$$;
