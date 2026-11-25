import { MessageCircle, Film, Camera, History, Wand2 } from 'lucide-react'
import ServiceCard from '../components/ServiceCard'
import Reveal from '../components/Reveal'
import { services, faq } from '../data/services'
import { WHATSAPP_URL } from '../lib/supabase'
const steps = [['Escolha o serviço','Veja o catálogo e abra o serviço desejado.'],['Crie sua conta','Cadastro rápido para acompanhar seu pedido.'],['Envie suas referências','Imagens, ideias e movimentos que você quer ver.'],['Receba o resultado','Acompanhe a produção e receba o material pronto.']]
export default function Home() {
  return (<>
  <section className="hero"><div className="aurora" /><div className="container heroGrid">
    <div className="heroText"><span className="tag"><i /> Inteligência artificial sob medida</span>
      <h1>Sua ideia, transformada em <em>vídeo e imagem</em> por IA.</h1>
      <p className="lead">Vídeos e fotografias personalizados, produzidos com atendimento direto e cuidado em cada detalhe.</p>
      <div className="cta"><a href="#servicos" className="btn">Conhecer os serviços</a><a className="btn ghost" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={18}/> WhatsApp</a></div></div>
    <div className="stage"><svg className="orbit" viewBox="0 0 400 400"><circle cx="200" cy="200" r="190" /><circle cx="200" cy="200" r="150" /></svg>
      <div className="photo"><img src="/perfil.jpg" alt="Foto de perfil do fundador da Cauã Viral" /><span className="scan" /></div>
      <span className="chip c1"><Film size={14}/> Vídeo</span><span className="chip c2"><Camera size={14}/> Fotografia</span><span className="chip c3"><History size={14}/> Restauração</span><span className="chip c4"><Wand2 size={14}/> IA</span></div>
  </div></section>
  <section id="servicos" className="container sec"><Reveal><span className="eyebrow">Catálogo</span><h2>Serviços para cada ideia</h2><p className="catalogIntro">Veja exemplos reais em cada serviço. Nos vídeos, toque em play para assistir.</p></Reveal>
    <div className="bento">{services.filter(s => s.slug !== "projeto-personalizado").map(s => <Reveal key={s.slug} className={`sp-${s.size}`}><ServiceCard s={s} /></Reveal>)}</div></section>
  <section id="exemplos" className="container sec showcase"><Reveal><span className="eyebrow">Resultados e referências</span><h2>Veja exemplos de possibilidades</h2><p className="catalogIntro">Alguns resultados e referências dos serviços, organizados em uma seleção visual.</p></Reveal>
   <div className="showcaseGrid"><figure className="showcaseItem showcaseWide"><img src="/images/ensaio-10.webp" alt="Ensaio fotográfico personalizado em ambiente externo" loading="lazy"/><figcaption><b>Ensaio fotográfico</b><span>Retratos com estética profissional</span></figcaption></figure>
    <figure className="showcaseItem"><img src="/images/personalizada-familia.webp" alt="Fotografia personalizada de mãe e filha" loading="lazy"/><figcaption><b>Foto personalizada</b><span>Momentos especiais</span></figcaption></figure>
    <figure className="showcaseItem"><img src="/images/old-man-custom.webp" alt="Exemplo de fotografia personalizada" loading="lazy"/><figcaption><b>Personalização</b><span>Novos cenários e estilos</span></figcaption></figure>
    <figure className="showcaseItem"><img src="/images/restauracao-before.webp" alt="Fotografia antiga antes da restauração" loading="lazy"/><figcaption><b>Restauração</b><span>Recuperação de memória</span></figcaption></figure>
    <figure className="showcaseItem"><img src="/images/restauracao-after.webp" alt="Fotografia antiga restaurada" loading="lazy"/><figcaption><b>Resultado restaurado</b><span>Mais nitidez e cor</span></figcaption></figure>
   </div></section>
  <section id="como-funciona" className="container sec"><Reveal><span className="eyebrow">Contratação</span><h2>Como funciona</h2></Reveal>
    <Reveal><ol className="steps">{steps.map(([t,d],i) => <li key={t}><div className="num">{i+1}</div><h3>{t}</h3><p>{d}</p></li>)}</ol></Reveal></section>
  <section className="container sec"><Reveal><div className="care"><h2>Atendimento personalizado</h2><p>Cada pedido é tratado individualmente. Para ideias fora do catálogo, fale direto pelo WhatsApp.</p>
    <a className="btn" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Falar no WhatsApp</a></div></Reveal></section>
  <section id="faq" className="container sec narrow"><Reveal><span className="eyebrow">Dúvidas</span><h2>Perguntas frequentes</h2>{faq.map(([q,a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}</Reveal></section>
  </>)
}
