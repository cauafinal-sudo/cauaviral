import { Link, useNavigate, useParams } from 'react-router-dom'
import { MessageCircle, ArrowLeft } from 'lucide-react'
import { useState } from 'react'
import { services } from '../data/services'
import { WHATSAPP_URL, supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Preview } from '../components/ServiceCard'
export default function ServicePage() {
  const { slug } = useParams(); const s = services.find(x => x.slug === slug);const {user}=useAuth();const nav=useNavigate();const [busy,setBusy]=useState(false);const [error,setError]=useState('')
  if (!s) return <div className="container sec"><h2>Serviço não encontrado</h2><Link to="/" className="btn">Voltar</Link></div>
  const service=s
  async function requestOrder(){if(!user){nav(`/entrar?redirect=${encodeURIComponent(`/servicos/${service.slug}`)}`);return}if(!supabase){setError('Supabase não está configurado.');return}setBusy(true);setError('');const {data,error:insertError}=await supabase.from('orders').insert({user_id:user.id,service_slug:service.slug,service_name:service.name,service_type:service.slug,amount:Number(service.amount.replace('R$','').replace('.','').replace(',','.'))}).select('id').single();setBusy(false);if(insertError){setError(`Não foi possível criar pedido: ${insertError.message}`);return}nav(`/cliente/pedidos/${data.id}`)}
  return (<div className="container sec"><Link to="/#servicos" className="back"><ArrowLeft size={16}/> Serviços</Link><div className="detail"><div className="detailPreview"><Preview slug={service.slug} name={service.name}/></div><div><h1>{service.name}</h1><div className="price big">{service.prefix && <small>{service.prefix}</small>}<b>{service.amount}</b>{service.note && <small>{service.note}</small>}</div><p className="lead">{service.description}</p><h3>Como funciona</h3><ol className="how">{service.how.map(h => <li key={h}>{h}</li>)}</ol>{service.custom ? <a className="btn" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Solicitar orçamento no WhatsApp</a>:<button className="btn" onClick={requestOrder} disabled={busy}>{busy?'Criando pedido…':'Contratar este serviço'}</button>}{error&&<div className="notice error">{error}</div>}<p className="finePrint">Ao contratar, o pedido ficará registrado na sua área do cliente. A confirmação do pagamento será feita separadamente.</p></div></div></div>)
}
