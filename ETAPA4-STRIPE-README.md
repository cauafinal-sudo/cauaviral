# Cauã Viral · Etapa 4 — Stripe Checkout

Esta etapa é uma integração real de backend, preparada para credenciais Stripe/Supabase do proprietário. O frontend não recebe a chave secreta. Os valores são obtidos do `service_catalog` no Supabase; a Edge Function confere o valor do pedido e monta Checkout em BRL.

## Antes de começar

- Faça backup do projeto, banco e arquivos de Storage.
- A integração usa o Supabase existente; não crie outro projeto.
- Stripe conta e credenciais são do proprietário. Nunca compartilhe secret keys no chat nem coloque secrets em GitHub/Vercel frontend.
- A prévia HTML (`preview-etapa4.html`) é uma demonstração visual; não realiza pagamentos nem acessa Supabase.

## 1. Aplicar migration

No Supabase existente → SQL Editor → New query, copie e execute o arquivo `supabase/step4_stripe.sql`. Faça backup antes. A migration é incremental, atualiza os preços do catálogo e adiciona tabelas de pagamentos, eventos e auditoria. Execute depois de `schema.sql` e `step3.sql`.

Catálogo online (BRL):
- Vídeo transformação com IA — R$ 39,99
- Ensaio 5 fotos — R$ 14,90
- Ensaio 10 fotos — R$ 24,90
- Restauração — R$ 9,90 por imagem (quantidade selecionada no site)
- Foto personalizada — R$ 14,90
- Animação de foto — R$ 24,90
- Projeto personalizado: orçamento via WhatsApp, não cria Checkout.

## 2. Configurar secrets das Edge Functions

Supabase Dashboard → Edge Functions → Secrets (ou CLI): configure os secrets abaixo, sem prefixo `VITE_`:

- `STRIPE_SECRET_KEY`: chave Stripe de teste (`sk_test_...`) primeiro.
- `STRIPE_WEBHOOK_SECRET`: secret de assinatura do endpoint webhook (`whsec_...`).
- `SUPABASE_SERVICE_ROLE_KEY`: service role do projeto Supabase (somente backend).
- `CHECKOUT_ALLOWED_ORIGIN`: `https://cauaviral.com` (para testes locais use `http://localhost:5173`).

O runtime já fornece `SUPABASE_URL` e `SUPABASE_ANON_KEY`. Não inclua secrets no `.env` que é servido pelo Vite nem em variáveis `VITE_`.

Para desenvolvimento local, use `supabase/functions/.env` (não comite esse arquivo) e rode `supabase functions serve --env-file supabase/functions/.env`.

## 3. Deploy das Edge Functions

Instale o Supabase CLI e faça login/link com o projeto existente:

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy create-checkout-session
supabase functions deploy stripe-webhook --no-verify-jwt
```

A função `create-checkout-session` exige JWT. A função `stripe-webhook` é pública na camada gateway, mas verifica assinatura criptográfica do Stripe no corpo raw antes de processar qualquer evento.

## 4. Criar webhook Stripe

Stripe Dashboard → Developers / Workbench → Webhooks → Add endpoint.

URL do endpoint:

`https://SEU_PROJECT_REF.supabase.co/functions/v1/stripe-webhook`

Assine os eventos:
- `checkout.session.completed`
- `checkout.session.async_payment_succeeded`
- `checkout.session.async_payment_failed`
- `checkout.session.expired`
- `payment_intent.payment_failed`
- `charge.refunded`

Copie o signing secret `whsec_...` do endpoint para o secret `STRIPE_WEBHOOK_SECRET` no Supabase. Não use o signing secret do CLI local no endpoint de produção.

## 5. Configuração frontend / Vercel

Confirme no Vercel → Project → Settings → Environment Variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

São apenas credenciais públicas. Não coloque `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` ou `SUPABASE_SERVICE_ROLE_KEY` na Vercel frontend.

Depois execute um novo deployment. O site usa o checkout hosted do Stripe; nenhum componente de cartão é carregado no frontend.

## 6. Testes em Stripe Test Mode

1. Use `sk_test_...` e o webhook de teste correspondente.
2. Abra o site, faça login e crie um pedido.
3. Clique em “Contratar e pagar com Stripe”.
4. Conclua com cartão de teste permitido pelo Stripe (ex.: `4242 4242 4242 4242`, data futura e CVC de 3 dígitos; use valores de teste apenas em Test Mode).
5. Aguarde o webhook; o status do pedido só passa a Pago por confirmação verificada no backend.
6. Confirme que o chat só abre depois do pedido `paid`.
7. Teste cancelar/expirar checkout, falha de pagamento e reembolso no Dashboard de Teste e confira `stripe_payments`, `stripe_webhook_events`, `order_audit_log`.
8. Repita webhook: o mesmo `event.id` é registrado e eventos processados são ignorados. O Checkout Session também usa chave de idempotência.

**Status de testes:** build frontend foi executado pelo pacote de entrega. Stripe Test Mode, webhooks remotos e os testes end-to-end de pagamento não foram executados nesta sessão porque não há credenciais/projeto Stripe/Supabase conectados.

## 7. Ativar produção

1. Conclua todos os testes em Test Mode.
2. No Stripe, habilite a conta e meios de pagamento necessários e obtenha `sk_live_...`.
3. Crie endpoint webhook de produção e copie o `whsec_...` de produção.
4. Atualize os secrets no Supabase para as chaves Live.
5. Confirme domínio `https://cauaviral.com`, URLs de Auth e `CHECKOUT_ALLOWED_ORIGIN`.
6. Faça deploy das funções e frontend, teste uma compra real de valor pequeno e confirme webhook e acesso.
7. Monitore Logs das Edge Functions, Stripe Webhook Events, transações e auditoria.

## 8. Fluxo / segurança

- Pedido: preço e nome sobrescritos pelo trigger do catálogo no banco; quantidade limitada de 1–100.
- Checkout: função autenticada verifica sessão, dono do pedido, preço/currency e status; Stripe Checkout em BRL.
- Webhook: valida `Stripe-Signature` usando corpo raw; consulta a Checkout Session no Stripe para eventos de conclusão; confere valor, moeda, pedido e user metadata.
- Chat: RLS existente exige `payment_status='paid'` para mensagens/anexos. A página de sucesso não desbloqueia chat por si só.
- Pagamentos: histórico por tentativa, status, ids Stripe, valor/refund, webhook deduplicado por event id.
- Auditoria: registra criação e alterações de status de pagamento/produção.
- Reembolso total bloqueia chat; reembolso parcial registra valor líquido e mantém o pedido paid (política que pode ser revisada).

## 9. Comandos

```bash
npm install
npm run dev
npm run build
npm run preview
```

## Limitações desta entrega

- É necessário aplicar a migration e publicar as Edge Functions no seu Supabase.
- Credenciais Stripe não foram inventadas nem incluídas.
- Não foram realizados testes reais de rede/checkout/webhook; faça o checklist em Test Mode antes de produção.
- Stripe não possui reembolso disparado pela interface administrativa nesta etapa; o reembolso deve ser efetuado no Stripe Dashboard, e o webhook sincroniza o status.
- O histórico de transações e faturamento líquido usa a tabela Stripe após a migration. Pedidos antigos pagos manualmente não são considerados receita Stripe.
