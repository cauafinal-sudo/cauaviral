# Correção visual do catálogo e da página de serviço

Esta revisão corrige o ponto que ficou faltando na versão anterior:

- O site carrega `src/styles/global.css` em `src/main.tsx`; os estilos de botão e mídia foram aplicados nesse arquivo realmente utilizado pela aplicação.
- Os links de contratação dos cards agora têm fundo destacado, borda, espaçamento, ícones e estados de hover.
- Na página individual de serviços de vídeo, a demonstração agora é um player de vídeo real com controles, em proporção 16:9 e sem corte do conteúdo.
- Nas páginas individuais de serviços de imagem, a imagem usa altura natural e `object-fit: contain`, para mostrar o arquivo inteiro.
- A comparação de restauração mantém as duas imagens lado a lado.

A quantidade e o cálculo do total existentes foram preservados.
