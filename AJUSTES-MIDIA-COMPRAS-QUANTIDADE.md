# Ajustes do Cauã Viral

## O que foi alterado
- A página de contratação agora permite selecionar quantidade (1 a 100) em todos os serviços pagos.
- O total é recalculado na tela; a quantidade segue gravada no pedido e é exibida também na área do cliente e no painel administrativo.
- O checkout Stripe usa a quantidade do pedido para calcular as unidades e o valor total.
- A prévia do serviço na página de detalhes preserva a proporção da imagem/vídeo e evita cortes.
- O chat mostra prévias inline de imagens e vídeos anexados, além de controles de reprodução e ação para baixar/abrir o arquivo.
- Os cards de serviços receberam um CTA de compra mais destacado.

## Etapa necessária no Supabase
A quantidade já existe na estrutura Stripe desta aplicação, mas a função SQL antiga limitava a quantidade a 1 para quase todos os serviços. Para liberar a quantidade em todos os serviços pagos:

1. Abra o Supabase do projeto.
2. Entre em **SQL Editor**.
3. Execute o arquivo `supabase/enable_quantity_all_services.sql`.

O projeto personalizado continua como orçamento via WhatsApp, sem checkout automático.

## Publicação
- Publique o frontend normalmente (build Vite).
- Publique novamente a Edge Function `create-checkout-session` com o código atualizado em `supabase/functions/create-checkout-session/index.ts`.
- Não é necessário alterar as chaves do Stripe nem os buckets de Storage.

## Verificação
Tente contratar, por exemplo, 2 unidades de um serviço de R$ 14,90: o pedido e o checkout devem mostrar R$ 29,80. Depois confirme que a quantidade aparece nos detalhes do pedido e no painel administrativo. Envie uma imagem e um vídeo no chat para validar a prévia e o download.
