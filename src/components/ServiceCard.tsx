import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ArrowUpRight, Play, X, MessageCircle, Sparkles, ShoppingBag } from 'lucide-react'
import type { Service } from '../data/services'

const serviceImages: Record<string,string> = {
 'video-transformacao':'/media/video-transformacao-poster.jpg',
 'ensaio-5-fotos':'/images/ensaio-5.webp',
 'ensaio-10-fotos':'/images/ensaio-10.webp',
 'restauracao-de-fotos':'/images/restauracao-after.webp',
 'foto-personalizada':'/images/personalizada-familia.webp',
 'animacao-de-foto':'/media/animacao-foto-poster.jpg',
}
const videoBySlug: Record<string,string> = {
 'video-transformacao':'/media/video-transformacao.mp4',
 'animacao-de-foto':'/media/animacao-foto.mp4'
}

function VideoModal({src,title,onClose}:{src:string;title:string;onClose:()=>void}) {
 const videoRef = useRef<HTMLVideoElement>(null)

 useEffect(() => {
  const previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  const onKey = (event: KeyboardEvent) => {
   if (event.key === 'Escape') {
    event.preventDefault()
    onClose()
   }
  }
  document.addEventListener('keydown', onKey)
  const video = videoRef.current
  if (video) {
   const playPromise = video.play()
   playPromise?.catch(() => {
    // A reprodução pode exigir interação em navegadores com autoplay restrito.
   })
  }
  return () => {
   document.removeEventListener('keydown', onKey)
   document.body.style.overflow = previousOverflow
   if (video) {
    video.pause()
    video.removeAttribute('src')
    video.querySelectorAll('source').forEach(source => source.removeAttribute('src'))
    video.load()
   }
  }
 }, [onClose, src])

 const modal = (
  <div className="videoModal" role="dialog" aria-modal="true" aria-label={title}
   onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
   <div className="videoModalPanel" onMouseDown={event => event.stopPropagation()}>
    <button type="button" className="modalClose" onClick={onClose} aria-label="Fechar vídeo"><X size={22}/></button>
    <div className="videoModalTitle">{title}</div>
    <video ref={videoRef} src={src} autoPlay controls playsInline preload="metadata">
     Seu navegador não reproduz vídeo.
    </video>
   </div>
  </div>
 )
 return createPortal(modal, document.body)
}

export function Preview({slug,name,detail=false}:{slug:string;name:string;detail?:boolean}) {
 const [videoOpen,setVideoOpen] = useState(false)
 const closeVideo = useCallback(() => setVideoOpen(false), [])
 if(detail && videoBySlug[slug]) return <div className="detailVideoFrame"><video src={videoBySlug[slug]} poster={serviceImages[slug]} controls playsInline preload="metadata">Seu navegador não reproduz este vídeo.</video></div>
 if(slug==='projeto-personalizado') return <div className="cardMedia customPreview"><div><MessageCircle size={30}/><strong>Seu projeto, sua ideia</strong><small>Orçamento personalizado</small></div></div>
 if(slug==='restauracao-de-fotos') return <div className="cardMedia comparePreview" aria-label="Comparação antes e depois da restauração">
  <figure><img src="/images/restauracao-before.webp" alt="Foto original antes da restauração"/><figcaption>Antes</figcaption></figure>
  <figure><img src="/images/restauracao-after.webp" alt="Foto restaurada"/><figcaption>Depois</figcaption></figure>
 </div>
 if(videoBySlug[slug]) return <>
  <button type="button" className="cardMedia videoCover" onClick={()=>setVideoOpen(true)} aria-label={`Assistir demonstração: ${name}`}>
   <img src={serviceImages[slug]} alt={`Capa do vídeo demonstrativo de ${name}`} />
   <span className="playButton"><Play fill="currentColor" size={24}/></span><span className="videoHint">Assistir demonstração</span>
  </button>
  {videoOpen&&<VideoModal src={videoBySlug[slug]} title={name} onClose={closeVideo}/>}
 </>
 return <div className={`cardMedia serviceImage image-${slug}`}><img src={serviceImages[slug]} alt={`Exemplo de ${name}`} loading="lazy"/></div>
}
export default function ServiceCard({s}:{s:Service}) {
 return <article className="svc"><Preview slug={s.slug} name={s.name}/><div className="sbody">
  <div className="serviceName"><h3>{s.name}</h3>{s.note&&<span className="packageNote">{s.note}</span>}</div>
  <p>{s.tagline}</p>
  <div className="sfoot"><div className="priceBox">{s.prefix&&<small>{s.prefix}</small>}<small className="startingAt">{s.custom?'Investimento':'A partir de'}</small><b>{s.amount}</b>{s.note&&<small>{s.note}</small>}</div>
   <Link className="buyButton" to={`/servicos/${s.slug}`}><ShoppingBag size={17}/>{s.custom?'Ver detalhes':'Quero contratar'} <ArrowUpRight size={16}/></Link>
  </div></div></article>
}
