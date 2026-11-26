import {useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import {useAuth} from '../auth/AuthContext'
import OrderChat from '../components/OrderChat'
type Order={id:string;service_name:string;service_type:string;amount:number;payment_status:string;production_status:string;created_at:string;updated_at:string}
const statusText=(s:string)=>({pending:'Pendente',paid:'Confirmado',failed:'Falhou',refunded:'Reembolsado',cancelled:'Cancelado',received:'Pendente',in_progress:'Em andamento',review:'Entregue',completed:'Concluído',on_hold:'Em espera'} as Record<string,string>)[s]||s
export default function OrderDetail(){const {id}=useParams();const {user}=useAuth();const [o,setO]=useState<Order|null>(null);const [err,setErr]=useState('')
 useEffect(()=>{if(!supabase||!user||!id)return;supabase.from('orders').select('*').eq('id',id).maybeSingle().then(({data,error})=>{if(error)setErr(error.message);else if(!data)setErr('Pedido não encontrado ou você não tem acesso.');else setO(data)})},[id,user])
 useEffect(()=>{if(!supabase||!id)return;const c=supabase.channel(`order-status-${id}`).on('postgres_changes',{event:'UPDATE',schema:'public',table:'orders',filter:`id=eq.${id}`},p=>setO(v=>v?{...v,...p.new as Order}:v)).subscribe();return()=>{supabase.removeChannel(c)}},[id])
 return <div className="container sec customer"><Link to="/cliente" className="back">← Meus pedidos</Link>{err?<div className="notice error">{err}</div>:!o?<p>Carregando pedido…</p>:<div className="orderDetailCard"><span className="eyebrow">Detalhes do pedido</span><h1>{o.service_name}</h1><div className="orderDetailId">Pedido #{o.id.toUpperCase()}</div><div className="detailGrid"><div><small>Data</small><b>{new Date(o.created_at).toLocaleString('pt-BR')}</b></div><div><small>Valor</small><b>{Number(o.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></div><div><small>Pagamento</small><b className="statusPill">{statusText(o.payment_status)}</b></div><div><small>Produção</small><b className="statusPill">{statusText(o.production_status)}</b></div></div>
 {o.payment_status==='paid'?<OrderChat orderId={o.id}/>:<div className="chatLocked"><b>Atendimento exclusivo bloqueado</b><p>O chat será liberado automaticamente quando o pagamento deste pedido for confirmado pelo sistema de pagamentos. Informar que pagou não altera este status.</p></div>}
 </div>}</div>}
