# Cauã Viral — Etapa 3

Continua a etapa 2. Não inclui processamento de pagamentos (etapa 4).

## Arquivos novos
- `src/components/OrderChat.tsx`: conversa por pedido, realtime, anexos com URLs assinadas, visualização inline de mídia, upload privado (limite configurado em 50 MB por arquivo).
- `src/components/AdminRoute.tsx`: proteção de rota por perfil `role=admin`.
- `src/pages/admin/AdminDashboard.tsx`: métricas calculadas dos registros do Supabase, notificações e pedidos recentes.
- `src/pages/admin/AdminOrders.tsx`: busca/filtros e atualização de status de produção.
- `src/pages/admin/AdminCustomers.tsx`: diretório de clientes e histórico.
- `src/pages/admin/AdminInbox.tsx`: central de conversas por pedido pago.
- `src/pages/admin/AdminOrderChat.tsx`: atendimento/admin por pedido, envio de arquivo final e status.
- `supabase/step3.sql`: migração de chat, estados de leitura, notificações, buckets privados, políticas RLS e Realtime.

## Instalação/atualização
1. Preserve `.env` local (não o compartilhe nem inclua no ZIP).
2. Execute `supabase/schema.sql` da etapa 2 se ainda não foi executado.
3. Execute `supabase/step3.sql` no SQL Editor do Supabase.
4. No dashboard Supabase, confira Database > Replication/Realtime e que `order_messages`, `order_attachments`, `orders` e `admin_notifications` estão publicados (o script tenta adicioná-los à publicação `supabase_realtime`).
5. Instale dependências com `npm install`, configure `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` e rode `npm run dev`.
6. Promova o proprietário da conta somente pelo SQL Editor: `UPDATE public.profiles SET role='admin' WHERE id='<UUID DO ADMIN>';`. Não há interface para alterar role.

## Regras de acesso
- Chat e anexos somente para pedidos com `payment_status='paid'`.
- O cliente só lê/escreve no pedido que pertence a ele; admin usa `public.is_admin()` (role no banco).
- Storage: buckets privados `customer-files`, `production-files`, `final-deliveries`; pasta inicial do objeto é UUID do pedido. Links de visualização são assinados por 10 minutos.
- Cliente só envia para bucket `customer-files`. Admin envia produção e entregas finais.
- Cliente não altera pagamento; RLS existente da etapa 2 permite update de pedidos somente para admin.
- Status de produção: `pending`, `in_progress`, `delivered`, `completed`; pagamento continua independente.

## Limites e observações
- Upload padrão Supabase Storage: 50 MB por arquivo neste script. Para uploads realmente grandes com retomada e progresso byte-a-byte, configurar upload resumível/TUS e elevar o limite do projeto Storage no Supabase.
- Dashboard mostra faturamento de pedidos com status `paid`, por pedido, sem duplicar linha de pedido. Pagamentos/refunds e webhook de confirmação ficam para etapa 4.
- Notificações são internas ao painel; não são push/e-mail. A entrega do pedido é visível em tempo real ao cliente via atualização da tabela `orders`.
- O chat só fica desbloqueado quando a coluna `payment_status` for alterada por operação administrativa/servidor autorizada. Não há botão de “já paguei”.
- A prévia HTML é visual/demonstrativa e não se conecta ao Supabase; os componentes React no projeto são a implementação funcional.
