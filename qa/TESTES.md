# QA da prévia HTML

Executado em Chromium headless via Playwright com HTML carregado no contexto da página:

- 7 cards do catálogo renderizados.
- 3 abas (catálogo, cliente, admin) alternam corretamente.
- 8 elementos `<img>` encontrados e todos carregaram (`naturalWidth > 0`).
- Formulário de mensagem da prévia cliente: mensagem de teste aparece no DOM (4 bubbles após envio).
- Aba administrativa renderizou sem erro JS.
- Desktop 1440px e celular 390px capturados.
- Console/page errors: 0.

Este teste é da prévia estática, não é teste de build React nem conexão Supabase. A instalação de dependências com `npm install` excedeu o timeout no ambiente, por isso não foi possível executar `npm run build` ou testar as rotas com banco real.
