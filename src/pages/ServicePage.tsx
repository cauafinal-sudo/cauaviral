import { Link, useNavigate, useParams } from 'react-router-dom'
import { MessageCircle, ArrowLeft, CreditCard, Minus, Plus } from 'lucide-react'
import { useState } from 'react'
import { services } from '../data/services'
import { WHATSAPP_URL, supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
import { Preview } from '../components/ServiceCard'
export default function ServicePage() {
 const { slug }=useParams(); const service=services.find(x=>x.slug===slug); const {user}=useAuth(); const nav=useNavigate(); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [quantity,setQuantity]=useState(1)
 if(!service)return <div className="container sec"><h2>Serviço não encontrado</h2><Link to="/" className="btn">Voltar</Link></div>
 const selectedService = service
 async function requestOrder(){
  if(selectedService.custom){window.open(WHATSAPP_URL,'_blank','noopener,noreferrer');return}
  if(!user){nav(`/entrar?redirect=${encodeURIComponent(`/servicos/${selectedService.slug}`)}`);return}
  if(!supabase){setError('Supabase não está configurado.');return}
  setBusy(true);setError('')
  const qty=selectedService.slug==='restauracao-de-fotos'?quantity:1
  const {data:order,error:insertError}=await supabase.from('orders').insert({user_id:user.id,service_slug:selectedService.slug,service_name:selectedService.name,service_type:selectedService.slug,quantity:qty}).select('id').single()
  if(insertError){setBusy(false);setError(`Não foi possível criar pedido: ${insertError.message}`);return}
  const {data,error:checkoutError}=await supabase.functions.invoke('create-checkout-session',{body:{order_id:order.id}})
  setBusy(false)
  if(checkoutError||!data?.checkout_url){setError(checkoutError?.message||data?.error||'Não foi possível iniciar o checkout.');nav(`/cliente/pedidos/${order.id}`);return}
  window.location.assign(data.checkout_url)
 }
 const unit=selectedService.slug==='restauracao-de-fotos'?9.90:Number(selectedService.amount.replace('R$','').replace('.','').replace(',','.'))
 const total=unit*(selectedService.slug==='restauracao-de-fotos'?quantity:1)
 return <div className="container sec"><Link to="/#servicos" className="back"><ArrowLeft size={16}/> Serviços</Link><div className="detail"><div className="detailPreview"><Preview slug={selectedService.slug} name={selectedService.name}/></div><div><h1>{selectedService.name}</h1><div className="price big"><b>{selectedService.amount}</b>{selectedService.note&&<small>{selectedService.note}</small>}</div><p className="lead">{selectedService.description}</p>{selectedService.slug==='restauracao-de-fotos'&&!selectedService.custom&&<div className="quantityPicker"><span>Quantidade de imagens</span><div><button type="button" className="iconBtn" onClick={()=>setQuantity(q=>Math.max(1,q-1))} aria-label="Diminuir"><Minus size={16}/></button><strong>{quantity}</strong><button type="button" className="iconBtn" onClick={()=>setQuantity(q=>Math.min(100,q+1))} aria-label="Aumentar"><Plus size={16}/></button></div><b>Total: {total.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></div>}<h3>Como funciona</h3><ol className="how">{selectedService.how.map(h=><li key={h}>{h}</li>)}</ol>{selectedService.custom?<a className="btn" href={WHATSAPP_URL} target="_blank" rel="noreferrer"><MessageCircle size={18}/> Solicitar orçamento no WhatsApp</a>:<button className="btn" onClick={requestOrder} disabled={busy}><CreditCard size={18}/>{busy?'Preparando checkout…':'Contratar e pagar com Stripe'}</button>}{error&&<div className="notice error">{error}</div>}<p className="finePrint">Pagamento processado com segurança pelo Stripe. O chat do pedido será liberado após confirmação do pagamento pelo webhook.</p></div></div></div>
}
