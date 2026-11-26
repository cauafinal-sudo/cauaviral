import {useCallback,useEffect,useMemo,useState} from 'react'
import type {ReactNode} from 'react'
import {Link,useNavigate} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import {useAuth} from '../auth/AuthContext'
import {Activity,Users,ShoppingBag,Wallet,Clock,CheckCircle2,MessageCircle,Search,RefreshCw,Bell} from 'lucide-react'
type Order={id:string;user_id:string;service_name:string;amount:number;payment_status:string;production_status:string;created_at:string}
type Profile={id:string;full_name:string;email:string;phone:string;role:string}
const money=(n:number)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL'})
const production=[['received','Pendente'],['in_progress','Em andamento'],['review','Entregue'],['completed','Concluído']] as const
export default function AdminDashboard(){
 const {user}=useAuth(),navigate=useNavigate(),[orders,setOrders]=useState<Order[]>([]),[profiles,setProfiles]=useState<Profile[]>([]),[loading,setLoading]=useState(true),[error,setError]=useState(''),[search,setSearch]=useState(''),[pay,setPay]=useState('all'),[prod,setProd]=useState('all'),[tab,setTab]=useState<'orders'|'clients'|'notifications'>('orders'),[notes,setNotes]=useState<any[]>([])
 const load=useCallback(async()=>{if(!supabase)return;setLoading(true);setError('')
  const [o,p,n,m]=await Promise.all([
   supabase.from('orders').select('id,user_id,service_name,amount,payment_status,production_status,created_at').order('created_at',{ascending:false}),
   supabase.from('profiles').select('id,full_name,email,phone,role').order('created_at',{ascending:false}),
   supabase.from('admin_notifications').select('*').order('created_at',{ascending:false}).limit(50),
   supabase.rpc('admin_dashboard_metrics')
  ])
  if(o.error)setError(o.error.message);else setOrders(o.data||[])
  if(p.error)setError(p.error.message);else setProfiles(p.data||[])
  if(!n.error)setNotes(n.data||[])
  else setError(n.error.message)
  if(m.error)setError(m.error.message);else setMetrics(m.data?.[0]||null)
  setLoading(false)
 },[])
 useEffect(()=>{load()},[load])
 useEffect(()=>{if(!supabase)return;const c=supabase.channel('admin-live')
  .on('postgres_changes',{event:'*',schema:'public',table:'orders'},load)
  .on('postgres_changes',{event:'*',schema:'public',table:'admin_notifications'},load)
  .subscribe();return()=>{supabase.removeChannel(c)}
 },[load])
 const profileMap=useMemo(()=>new Map(profiles.map(p=>[p.id,p])),[profiles])
 const now=new Date()
 const total=Number(metrics?.total_revenue||0),monthly=Number(metrics?.monthly_revenue||0)
 const pending=Number(metrics?.pending_orders||0),working=Number(metrics?.in_progress_orders||0),delivered=Number(metrics?.delivered_orders||0),completed=Number(metrics?.completed_orders||0),awaiting=Number(metrics?.awaiting_service_orders||0)
 const filtered=orders.filter(o=>{const p=profileMap.get(o.user_id);const term=search.toLowerCase();return (!term||[o.id,o.service_name,p?.full_name,p?.email,p?.phone].some(v=>String(v||'').toLowerCase().includes(term)))&&(pay==='all'||o.payment_status===pay)&&(prod==='all'||o.production_status===prod)})
 async function updateStatus(id:string,value:string){if(!supabase)return;const {error}=await supabase.from('orders').update({production_status:value}).eq('id',id);if(error)setError(error.message);else await load()}
 async function markRead(id:string){if(!supabase)return;await supabase.from('admin_notifications').update({read_at:new Date().toISOString()}).eq('id',id);setNotes(v=>v.map(n=>n.id===id?{...n,read_at:new Date().toISOString()}:n))}
 async function markAll(){if(!supabase)return;await supabase.from('admin_notifications').update({read_at:new Date().toISOString()}).is('read_at',null);load()}
 const unread=notes.filter(n=>!n.read_at).length
 if(!supabase)return <div className="container sec"><div className="notice error">Configure o Supabase para acessar o painel.</div></div>
 return <div className="container sec adminPage">
  <div className="adminHeading"><div><span className="eyebrow">Cauã Viral · gestão</span><h1>Painel administrativo</h1><p>Indicadores e operação atualizados diretamente pelo Supabase.</p></div><div className="adminActions"><button className="btn ghost" onClick={load}><RefreshCw size={16}/> Atualizar</button><button className="btn ghost" onClick={markAll}><Bell size={16}/> {unread} não lidas</button></div></div>
  {error&&<div className="notice error">{error}</div>}
  <div className="adminMetrics">
   <Metric icon={<Wallet/>} label="Faturamento total" value={money(total)} note="Somente pagamentos confirmados"/>
   <Metric icon={<Activity/>} label="Faturamento do mês" value={money(monthly)} note={now.toLocaleDateString('pt-BR',{month:'long',year:'numeric'})}/>
   <Metric icon={<ShoppingBag/>} label="Total de pedidos" value={String(metrics?.total_orders??orders.length)} note={`${pending} aguardando pagamento`}/>
   <Metric icon={<Clock/>} label="Em andamento" value={String(working)} note={`${awaiting} aguardando atendimento`}/>
   <Metric icon={<CheckCircle2/>} label="Entregues / concluídos" value={`${delivered} / ${completed}`} note="Status de produção"/>
   <Metric icon={<Users/>} label="Clientes cadastrados" value={String(metrics?.customer_count??profiles.filter(p=>p.role==='customer').length)} note="Perfis registrados"/>
  </div>
  <div className="adminTabs"><button className={tab==='orders'?'active':''} onClick={()=>setTab('orders')}>Pedidos ({orders.length})</button><button className={tab==='clients'?'active':''} onClick={()=>setTab('clients')}>Clientes ({profiles.length})</button><button className={tab==='notifications'?'active':''} onClick={()=>setTab('notifications')}>Notificações {unread>0&&<i>{unread}</i>}</button></div>
  {tab==='orders'&&<section className="adminPanel"><div className="adminFilters"><label><Search size={16}/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar pedido, cliente, e-mail ou telefone"/></label><select value={pay} onChange={e=>setPay(e.target.value)}><option value="all">Todos pagamentos</option><option value="pending">Pendente</option><option value="paid">Confirmado</option><option value="failed">Falhou</option><option value="refunded">Reembolsado</option><option value="cancelled">Cancelado</option></select><select value={prod} onChange={e=>setProd(e.target.value)}><option value="all">Toda produção</option>{production.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></div>
  {loading?<p>Carregando…</p>:<div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Pedido</th><th>Cliente</th><th>Serviço</th><th>Valor</th><th>Pagamento</th><th>Produção</th><th>Data</th><th>Atendimento</th></tr></thead><tbody>{filtered.map(o=>{const p=profileMap.get(o.user_id);return <tr key={o.id}><td><b>#{o.id.slice(0,8).toUpperCase()}</b></td><td>{p?.full_name||'Cliente'}<small>{p?.phone||p?.email||''}</small></td><td>{o.service_name}</td><td>{money(Number(o.amount))}</td><td><span className={`state ${o.payment_status}`}>{o.payment_status==='paid'?'Confirmado':o.payment_status}</span></td><td><select className="statusSelect" value={o.production_status} onChange={e=>updateStatus(o.id,e.target.value)}>{production.map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></td><td>{new Date(o.created_at).toLocaleDateString('pt-BR')}</td><td><Link className="tableLink" to={`/admin/pedidos/${o.id}`}><MessageCircle size={15}/> Abrir chat</Link></td></tr>})}</tbody></table>{filtered.length===0&&<p className="emptyAdmin">Nenhum pedido corresponde aos filtros.</p>}</div>}</section>}
  {tab==='clients'&&<section className="adminPanel"><div className="adminTableWrap"><table className="adminTable"><thead><tr><th>Cliente</th><th>E-mail</th><th>Telefone</th><th>Pedidos</th><th>Histórico</th></tr></thead><tbody>{profiles.filter(p=>p.role==='customer').map(p=><tr key={p.id}><td><b>{p.full_name||'Sem nome'}</b></td><td>{p.email}</td><td>{p.phone}</td><td>{orders.filter(o=>o.user_id===p.id).length}</td><td><Link className="tableLink" to={`/admin/clientes/${p.id}`}>Ver pedidos</Link></td></tr>)}</tbody></table></div></section>}
  {tab==='notifications'&&<section className="adminPanel"><div className="notifHead"><h2>Central de notificações</h2><button className="btn ghost small" onClick={markAll}>Marcar todas como lidas</button></div>{notes.length===0?<p>Nenhuma notificação registrada.</p>:notes.map(n=><button className={`notificationRow ${!n.read_at?'unread':''}`} key={n.id} onClick={()=>{markRead(n.id);if(n.order_id)navigate(`/admin/pedidos/${n.order_id}`)}}><span className="notifIcon"><Bell size={18}/></span><span><b>{n.title}</b><small>{n.body}</small><small>{new Date(n.created_at).toLocaleString('pt-BR')}</small></span><span>{n.read_at?'Lida':'Não lida'}</span></button>)}</section>}
 </div>
}
function Metric({icon,label,value,note}:{icon:ReactNode;label:string;value:string;note:string}){return <div className="metricCard"><span>{icon}</span><small>{label}</small><strong>{value}</strong><em>{note}</em></div>}
