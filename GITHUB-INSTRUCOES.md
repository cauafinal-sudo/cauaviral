# Atualizar o repositório GitHub — Cauã Viral

Este ZIP contém o projeto completo com a estrutura na raiz, pronto para extrair e enviar ao repositório.

## Atualização pelo site do GitHub
1. Faça backup/baixe a versão atual do repositório.
2. Extraia o ZIP no computador.
3. Abra o repositório correto no GitHub.
4. Entre na pasta do projeto (ou na raiz do repositório, conforme a estrutura atual).
5. Use **Add file → Upload files** e arraste os arquivos e pastas extraídos. Não envie `node_modules`, `dist` nem `.env`.
6. Revise as alterações e faça **Commit changes**.

## Atualização pelo Git (recomendado)
Extraia o ZIP e, no terminal dentro da pasta do projeto:

```bash
git status
git add -A
git commit -m "Atualiza Cauã Viral com chat e painel administrativo"
git push
```

Se você já tem um clone local do repositório, copie o conteúdo desta pasta para a pasta do clone antes dos comandos acima. Não apague arquivos que pertençam a outras etapas sem revisar o diff.

## Instalação e execução

```bash
npm install
npm run dev
```

Para validar build local:

```bash
npm run build
```

Configure as variáveis copiando `.env.example` para `.env`. Nunca envie `.env`, `service_role` ou chaves secretas ao GitHub.

## Supabase
- `supabase/schema.sql`: esquema base entregue na etapa anterior.
- `supabase/etapa3-chat-admin.sql`: migração adicional da etapa 3. Aplicar depois do esquema base.

A integração com o provedor de pagamento/webhook continua fora desta etapa. O checkout real e a confirmação automática permanecem para a etapa 4.
