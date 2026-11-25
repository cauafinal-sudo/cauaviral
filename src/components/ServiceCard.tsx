import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Play, X } from 'lucide-react'
import type { Service } from '../data/services'

const serviceImages: Record<string,string> = {
 'video-transformacao':'/media/video-transformacao-poster.jpg',
 'ensaio-5-fotos':'/images/ensaio-5.webp',
 'ensaio-10-fotos':'/images/ensaio-10.webp',
 'restauracao-de-fotos':'/images/restauracao-after.webp',
 'foto-personalizada':'/images/personalizada-familia.webp',
 'animacao-de-foto':'/media/animacao-foto-poster.jpg',
 'projeto-personalizado':'/images/old-man-custom.webp'
}
const videoBySlug: Record<string,string> = {
 'video-transformacao':'/media/video-transformacao.mp4',
 'animacao-de-foto':'/media/animacao-foto.mp4'
}
function VideoModal({src,title,onClose}:{src:string;title:string;onClose:()=>void}) {
 useEffect(()=>{
  const onKey=(e:KeyboardEvent)=>{if(e.key==='Escape')onClose()}
  document.addEventListener('keydown',onKey); document.body.style.overflow='hidden'
  return ()=>{document.removeEventListener('keydown',onKey);document.body.style.overflow=''}
 },[onClose])
 return <div className="videoModal" role="dialog" aria-modal="true" aria-label={title} onMouseDown={e=>{if(e.target===e.currentTarget)onClose()}}>
  <div className="videoModalPanel"><button className="modalClose" onClick={onClose} aria-label="Fechar vídeo"><X size={22}/></button><div className="videoModalTitle">{title}</div><video autoPlay controls playsInline preload="auto">
    <source src={src} type="video/mp4"/>
    Seu navegador não reproduz vídeo.
   </video></div>
 </div>
}
export function Preview({slug,name}:{slug:string;name:string}) {
 const [videoOpen,setVideoOpen]=useState(false)
 if(slug==='restauracao-de-fotos') return <div className="cardMedia comparePreview" aria-label="Comparação antes e depois da restauração">
  <figure><img src="/images/restauracao-before.webp" alt="Foto original antes da restauração"/><figcaption>Antes</figcaption></figure>
  <figure><img src="/images/restauracao-after.webp" alt="Foto restaurada"/><figcaption>Depois</figcaption></figure>
 </div>
 if(videoBySlug[slug]) return <>
  <button className="cardMedia videoCover" onClick={()=>setVideoOpen(true)} aria-label={`Assistir demonstração: ${name}`}>
   <img src={serviceImages[slug]} alt={`Capa do vídeo demonstrativo de ${name}`} />
   <span className="playButton"><Play fill="currentColor" size={24}/></span><span className="videoHint">Assistir demonstração</span>
  </button>
  {videoOpen&&<VideoModal src={videoBySlug[slug]} title={name} onClose={()=>setVideoOpen(false)}/>}
 </>
 return <div className="cardMedia serviceImage"><img src={serviceImages[slug]} alt={`Exemplo de ${name}`} loading="lazy"/></div>
}
export default function ServiceCard({s}:{s:Service}) {
 return <article className="svc"><Preview slug={s.slug} name={s.name}/><div className="sbody">
  <div className="serviceName"><h3>{s.name}</h3>{s.note&&<span className="packageNote">{s.note}</span>}</div>
  <p>{s.tagline}</p>
  <div className="sfoot"><div className="priceBox">{s.prefix&&<small>{s.prefix}</small>}<b>{s.amount}</b>{s.note&&s.slug!=='restauracao-de-fotos'&&<small>{s.note}</small>}</div>
   <Link className="go" to={`/servicos/${s.slug}`}>{s.custom?'Detalhes':'Contratar'} <ArrowUpRight size={17}/></Link>
  </div></div></article>
}
