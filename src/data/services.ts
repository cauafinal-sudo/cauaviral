export type Service = { slug: string; name: string; price: string; prefix?: string; amount: string; note?: string; tagline: string; description: string; how: string[]; custom?: boolean; size: 'xl'|'md'|'sm'|'lg' }
const common = ['Crie sua conta e escolha o serviço.','Envie suas imagens e referências.','Acompanhe o pedido na sua área do cliente.','Receba o resultado pronto.']
export const services: Service[] = [
 { slug:'video-transformacao', name:'Vídeo transformação com IA', price:'R$ 39,99', amount:'R$ 39,99', size:'xl', tagline:'Veja sua ideia ganhar movimento. Você escolhe os movimentos e as referências.', description:'Criação de vídeos personalizados utilizando inteligência artificial, permitindo que o cliente escolha movimentos e referências.', how:common },
 { slug:'ensaio-5-fotos', name:'Ensaio fotográfico com IA', price:'R$ 19,90', amount:'R$ 19,90', note:'5 fotos', size:'sm', tagline:'Retratos com aparência de estúdio, criados a partir das suas fotos.', description:'Criação de fotografias profissionais personalizadas utilizando imagens enviadas pelo cliente. Pacote com 5 fotos.', how:common },
 { slug:'ensaio-10-fotos', name:'Ensaio fotográfico com IA', price:'R$ 29,90', amount:'R$ 29,90', note:'10 fotos', size:'lg', tagline:'O pacote maior, com mais opções de retratos profissionais.', description:'Criação de fotografias profissionais personalizadas utilizando imagens enviadas pelo cliente. Pacote com 10 fotos.', how:common },
 { slug:'restauracao-de-fotos', name:'Restauração de fotos', price:'R$ 9,90 por imagem', amount:'R$ 9,90', note:'por imagem', size:'lg', tagline:'Dê nova vida a fotografias antigas.', description:'Recuperação e melhoria de fotografias antigas.', how:common },
 { slug:'foto-personalizada', name:'Foto personalizada', price:'R$ 14,90', amount:'R$ 14,90', size:'sm', tagline:'Montagens, cenários e fotos com familiares: a ideia é sua.', description:'Criação de imagens personalizadas. O cliente pode solicitar montagens, fotografias com familiares, cenários e outras ideias.', how:common },
 { slug:'animacao-de-foto', name:'Animação de foto', price:'R$ 24,90', amount:'R$ 24,90', size:'md', tagline:'Sua foto parada ganha vida em vídeo.', description:'Transformação de fotografias estáticas em vídeos animados.', how:common },
 { slug:'projeto-personalizado', name:'Projeto personalizado', price:'A partir de R$ 29,90', amount:'A partir de R$ 29,90', size:'md', custom:true, tagline:'Uma ideia exclusiva? Vamos conversar e definir seu orçamento.', description:'Projetos fora do catálogo são avaliados individualmente e contratados diretamente pelo WhatsApp.', how:['Conte sua ideia pelo WhatsApp.','Receba um orçamento personalizado.','Combine os detalhes e prazo diretamente.'] },
]
export const faq = [
 ['Preciso de conta para contratar?','Sim. Crie uma conta com nome, e-mail, telefone e senha. Depois, você poderá registrar pedidos e acompanhar tudo pela área do cliente.'],
 ['Como funciona o projeto personalizado?','Você fala direto pelo WhatsApp, explica a ideia e solicita um orçamento. Não há pagamento antecipado pelo site.'],
 ['Quais imagens posso enviar?','Envie apenas imagens suas ou que você tenha autorização para usar.'],
 ['Como acompanho meu pedido?','Entre na sua área do cliente para consultar pedidos, valores e status de pagamento e produção.'],
]
