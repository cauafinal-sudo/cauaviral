# Cauã Viral — projeto

Este ZIP contém as etapas anteriores e os arquivos incrementais da Etapa 4 (Stripe).

**Comece por `ETAPA4-STRIPE-README.md`** para aplicar a migration `supabase/step4_stripe.sql`, configurar os secrets e publicar as Edge Functions. Não habilite chaves live antes dos testes em Stripe Test Mode.

A prévia visual da Etapa 4 é `preview-etapa4.html` e não processa pagamentos.

# Cauã Viral — Etapa 2: Supabase Auth + área de clientes

Este projeto continua a etapa 1 (React, Vite, TypeScript) e mantém os componentes, catálogo, mídia, estilos e navegação existentes. Não inclui a implementação do chat (etapa 3).

## 1. Configuração local

1. Instale Node.js 20+.
2. Na raiz do projeto, instale dependências: `npm install`.
3. Copie `.env.example` para `.env` e preencha as credenciais **públicas** do Supabase:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` (ou a chave `publishable` pública compatível)
4. Execute o script `supabase/schema.sql` no SQL Editor do Supabase.
5. No Supabase Authentication → URL Configuration, configure Site URL e URLs de redirecionamento locais e de produção. Inclua `/entrar` e `/nova-senha` no domínio.
6. Para ativar confirmação por e-mail, mantenha Email confirmation ligado e configure SMTP confiável no Supabase. O signup apresenta aviso quando a confirmação for necessária.
7. Execute `npm run dev` e abra o endereço indicado pelo Vite. Para compilar produção: `npm run build`.

**Sem .env**, o site público continua navegável, mas as telas de autenticação exibem um aviso de configuração. Não coloque `service_role`/secret key no frontend ou no `.env` com prefixo `VITE_`.

## 2. Cadastro e login

- Cadastro: nome completo, e-mail, telefone, senha e confirmação. Senha mínima 8 caracteres.
- O telefone e o nome são enviados como metadados do Auth; trigger do banco cria `profiles`.
- Login por e-mail/senha via Supabase Auth; a sessão persiste no armazenamento gerenciado pelo SDK.
- Recuperação: `/recuperar-senha`; link de redefinição direciona a `/nova-senha`.
- `/cliente`, `/cliente/perfil` e `/cliente/pedidos/:id` são protegidos por rota e sessão.
- Ao contratar um serviço normal, usuário não autenticado é encaminhado ao login; autenticado cria pedido e acessa detalhes. Serviço personalizado continua sendo orçamento por WhatsApp.

## 3. SQL / RLS

Execute `supabase/schema.sql`. Ele cria:

- `profiles`: perfil, telefone e papel `customer/admin`.
- `service_catalog`: catálogo e preço autoritativo no banco.
- `orders`: pedidos, status de pagamento e produção.
- `order_messages` e `order_attachments`: estrutura preparatória para a etapa 3 (sem interface de chat nesta etapa).

RLS está ativado. Clientes consultam apenas perfil e pedidos próprios. Administradores (role atribuída manualmente) têm leitura de todos os pedidos e permissões de atualização de pedido. O trigger de perfil impede que um cliente altere a própria role ou e-mail; os campos editáveis pela tela são nome e telefone. Trigger de pedido sobrescreve nome/tipo/preço/status a partir do catálogo, evitando confiar no valor enviado pelo browser.

### Promover administrador (procedimento controlado)

1. Cadastre a conta do proprietário pela tela de cadastro e confirme o e-mail.
2. Obtenha o UUID da conta em Authentication → Users.
3. Execute, no SQL Editor como operador privilegiado, substituindo o UUID:

```sql
update public.profiles
set role = 'admin'
where id = 'UUID-DA-CONTA-DO-PROPRIETARIO';
```

Não existe botão de admin na interface de cliente. O cliente não pode promover a si próprio por atualização no browser. Guarde acesso ao dashboard/SQL Editor com MFA.

## 4. Preços

Os valores do catálogo SQL foram alinhados com os cards existentes: transformação R$ 39,99; ensaio 5 fotos R$ 19,90; ensaio 10 fotos R$ 29,90; restauração R$ 9,90 por imagem; foto personalizada R$ 14,90; animação R$ 24,90. Serviço personalizado não cria pedido online; continua no WhatsApp.

Se os preços do site mudarem, atualize também os registros de `service_catalog` no SQL para que a criação de pedidos use o valor vigente.

## 5. Limites desta entrega

- Não foram criadas chaves, projeto Supabase ou credenciais: o proprietário precisa configurar seu próprio projeto e executar SQL.
- Chat, envio de arquivos e cobrança online estão reservados para próximas etapas.
- A prévia HTML é standalone e demonstra visual/fluxos; formulários nessa prévia são simulados. A autenticação real funciona no React quando Supabase estiver configurado.
