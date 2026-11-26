import {useEffect,useState} from 'react'
import {Link,useParams} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import OrderChat from '../components/OrderChat'
export default function AdminOrder(){const {id}=useParams();const [order,setOrder]=useState<any>(null),[client,setClient]=useState<any>(null),[error,setError]=useState('')
 useEffect(()=>{if(!supabase||!id)return;(async()=>{const {data,error}=await supabase.from('orders').select('*').eq('id',id).single();if(error){setError(error.message);return}setOrder(data);const p=await supabase.from('profiles').select('*').eq('id',data.user_id).single();setClient(p.data)})()},[id])
 return <div className="container sec adminPage"><Link className="back" to="/admin">← Painel</Link>{error&&<div className="notice error">{error}</div>}{!order?<p>Carregando pedido…</p>:<><div className="adminHeading"><div><span className="eyebrow">Atendimento</span><h1>{order.service_name}</h1><p>Pedido #{order.id.slice(0,8).toUpperCase()} · {client?.full_name} · {client?.email} · {client?.phone}</p></div></div><div className="detailGrid adminOrderMeta"><div><small>Pagamento</small><b>{order.payment_status==='paid'?'Confirmado':order.payment_status}</b></div><div><small>Produção</small><b>{order.production_status}</b></div><div><small>Valor</small><b>{Number(order.amount).toLocaleString('pt-BR',{style:'currency',currency:'BRL'})}</b></div></div>{order.payment_status==='paid'?<OrderChat orderId={order.id} admin/>:<div className="chatLocked">O chat permanece bloqueado até confirmação real do pagamento.</div>}</>}</div>
}
