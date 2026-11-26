# Cauã Viral — Etapa 3: chat privado e painel administrativo

Esta etapa continua o projeto da etapa 2, mantendo o catálogo, páginas, mídia, estilos, autenticação, perfil e fluxo de contratação existentes. Foram adicionados chat por pedido, uploads privados, painel administrativo, gerenciamento de pedidos/clientes e notificações internas.

## Stack
- React, Vite e TypeScript
- Supabase Auth, Database, Storage e Realtime
- Supabase Row Level Security (RLS)

## 1. Instalação e configuração

1. Requer Node.js 20+.
2. Na raiz, execute `npm install`.
3. Copie `.env.example` para `.env` e preencha `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY` com credenciais públicas.
4. Execute primeiro `supabase/schema.sql` (etapa 2) se ainda não tiver aplicado.
5. Execute `supabase/etapa3-chat-admin.sql` no SQL Editor do Supabase.
6. Configure `VITE_MAX_UPLOAD_BYTES` (padrão 536870912 = 512 MiB) conforme os limites do seu projeto/plano. O bucket também tem limite inicial de 512 MiB por objeto.
7. Rode `npm run dev`; para produção, `npm run build`.

Nunca coloque `service_role` ou secret key em variáveis `VITE_` ou no frontend.

## 2. Administrador

O papel de administrador é concedido somente pelo operador no SQL Editor, depois do cadastro da conta:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID-DA-CONTA-DO-PROPRIETARIO';
```

Acesse `/admin`. As rotas administrativas verificam a role no perfil, mas a autorização efetiva também é aplicada no banco por RLS e políticas de Storage. A proteção do frontend não é a barreira de segurança.

## 3. Chat por pedido e regra de pagamento

- Cada pedido tem uma conversa individual acessível em `/cliente/pedidos/:id`.
- A interface só renderiza o chat quando `orders.payment_status = 'paid'`.
- RLS repete a regra: o cliente só pode ler/inserir mensagens e anexos de pedido próprio cujo pagamento esteja `paid`. Administradores autorizados podem atender os pedidos.
- Mensagens e anexos atualizam em tempo real por Supabase Realtime.
- Mensagens possuem `read_at`; ao abrir a conversa, o destinatário marca as mensagens recebidas como lidas.
- O cliente não pode alterar `payment_status`, valor, proprietário ou produção do pedido. As políticas existentes de pedidos permitem atualização apenas ao admin; trigger adicional protege campos críticos.
- **Não existe confirmação de pagamento nesta etapa.** O status só pode ser alterado por operação administrativa autorizada ou serviço privilegiado do provedor. A integração automática e verificação de webhook pertencem à etapa 4. Não marque pedidos como pagos manualmente para simular checkout em produção.

## 4. Storage e arquivos

Buckets privados criados pelo SQL:
- `client-uploads`: arquivos enviados pelo cliente.
- `production-files`: arquivos internos de produção.
- `final-deliveries`: arquivos finais enviados pelo administrador.

O upload no chat usa XHR com token da sessão e indicador de progresso. O frontend valida MIME e tamanho; Storage e RLS também aplicam controles no servidor. Downloads e prévias usam URLs assinadas temporárias de 5 minutos. Os arquivos não ficam públicos.

Formatos habilitados inicialmente: JPEG, PNG, WebP, GIF, MP4, WebM, formatos comuns de áudio, PDF, TXT, ZIP, DOCX e XLSX. O limite inicial por objeto é 512 MiB, sujeito ao limite efetivo do plano Supabase. Ajuste a lista MIME e os limites no SQL e em `src/lib/storage.ts` em conjunto.

## 5. Painel administrativo

- `/admin`: dashboard, pedidos, clientes e notificações.
- `/admin/pedidos/:id`: atendimento por pedido.
- `/admin/clientes/:id`: cadastro e histórico de pedidos.

Os indicadores são calculados por `admin_dashboard_metrics()` no próprio banco, evitando truncamento da contagem e das somas pelo limite de linhas da API. Faturamento considera exclusivamente pedidos com `payment_status = 'paid'`, sem somar eventos de pagamento duplicados. O faturamento mensal usa `created_at` do pedido como referência de competência; caso a etapa 4 adicione `paid_at`, a regra poderá ser refinada para a data efetiva de liquidação.

Status de produção apresentados:
- `received` → Pendente
- `in_progress` → Em andamento
- `review` → Entregue
- `completed` → Concluído

Pagamento e produção são campos separados.

## 6. Notificações internas

Triggers no banco registram notificações para:
- Pagamento confirmado (quando `payment_status` muda para `paid`).
- Pedido pago aguardando atendimento.
- Mensagem enviada pelo cliente.
- Arquivo enviado pelo cliente.
- Pedido marcado como entregue (`review`).

As notificações ficam em `admin_notifications` e são visíveis apenas a administradores. O painel acompanha novas notificações em tempo real.

## 7. Arquivos importantes adicionados

- `supabase/etapa3-chat-admin.sql`
- `src/components/OrderChat.tsx`
- `src/components/AdminRoute.tsx`
- `src/lib/storage.ts`
- `src/pages/AdminDashboard.tsx`
- `src/pages/AdminOrder.tsx`
- `src/pages/AdminClient.tsx`
- `src/pages/OrderDetail.tsx` (atualizado)
- `src/App.tsx` (rotas administrativas)
- `previa-atualizada.html` (prévia estática do catálogo e dos novos módulos)

## 8. Observações operacionais e limites

- A prévia HTML é estática e não autentica nem consulta Supabase; o aplicativo React é a implementação funcional.
- Upload grande depende dos limites do projeto Supabase, da rede e do plano. Para arquivos realmente grandes ou redes instáveis, avalie Supabase TUS resumable uploads em evolução posterior.
- O status `paid` precisa ser escrito pelo backend/webhook validado da etapa 4. A presente etapa não cria endpoint de pagamento nem confia em botão do cliente.
- A etapa 4 não foi iniciada.
