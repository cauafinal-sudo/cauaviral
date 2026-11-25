import { WHATSAPP_URL } from '../lib/supabase'
export default function Footer() {
  return (<footer className="footer"><div className="container foot">
    <div><div className="logo">Cauã<span>Viral</span></div><p>Vídeos e fotografias personalizados com inteligência artificial.</p></div>
    <div><a href={WHATSAPP_URL} target="_blank" rel="noreferrer">WhatsApp</a><br/><span>cauaviral.com</span></div>
  </div><p className="copy">© {new Date().getFullYear()} Cauã Viral. Todos os direitos reservados.</p></footer>)
}
