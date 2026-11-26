-- Atualiza os preços dos pacotes de ensaio fotográfico com IA.
-- Execute uma vez no Supabase: SQL Editor -> New query -> Run.
-- Pedidos já criados mantêm o valor registrado; os novos pedidos usam estes preços.

update public.service_catalog
set amount = 19.90, updated_at = now()
where slug = 'ensaio-5-fotos';

update public.service_catalog
set amount = 29.90, updated_at = now()
where slug = 'ensaio-10-fotos';
