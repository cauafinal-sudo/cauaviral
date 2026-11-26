import {useCallback,useEffect,useRef,useState} from 'react'
import type {FormEvent,ChangeEvent} from 'react'
import {supabase} from '../lib/supabase'
import {useAuth} from '../auth/AuthContext'
import {getPrivateFileUrl,uploadPrivateFile} from '../lib/storage'
import {Paperclip,Send,Download,FileVideo,Image as ImageIcon,Headphones,FileText,LoaderCircle} from 'lucide-react'

type Message={id:string;order_id:string;sender_id:string;body:string;created_at:string;read_at?:string|null}
type Attachment={id:string;order_id:string;owner_id:string;bucket_id?:string;storage_path:string;original_name:string;mime_type:string|null;size_bytes:number|null;created_at:string}
const fmt=(d:string)=>new Date(d).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})
function FileItem({file}:{file:Attachment}) {
 const [url,setUrl]=useState('')
 useEffect(()=>{let live=true;getPrivateFileUrl(file.storage_path,file.bucket_id||'client-uploads').then(u=>{if(live)setUrl(u)}).catch(()=>{});return()=>{live=false}},[file.storage_path])
 const mime=file.mime_type||''
 return <div className="chatFile">
  {mime.startsWith('image/')&&url?<a href={url} target="_blank" rel="noreferrer"><img src={url} alt={file.original_name}/></a>:mime.startsWith('video/')&&url?<video controls preload="metadata" src={url}/>:mime.startsWith('audio/')&&url?<audio controls src={url}/>:<span className="fileIcon">{mime.startsWith('video/')?<FileVideo/>:mime.startsWith('image/')?<ImageIcon/>:mime.startsWith('audio/')?<Headphones/>:<FileText/>}</span>}
  <div className="fileMeta"><b>{file.original_name}</b><small>{file.size_bytes?`${(file.size_bytes/1024/1024).toFixed(1)} MB`:'Arquivo'}</small></div>
  {url&&<a className="iconBtn" href={url} download={file.original_name} target="_blank" rel="noreferrer" aria-label="Baixar arquivo"><Download size={17}/></a>}
 </div>
}
export default function OrderChat({orderId,admin=false}:{orderId:string;admin?:boolean}) {
 const {user}=useAuth(),[messages,setMessages]=useState<Message[]>([]),[files,setFiles]=useState<Attachment[]>([]),[body,setBody]=useState(''),[busy,setBusy]=useState(false),[progress,setProgress]=useState(0),[error,setError]=useState(''),[loading,setLoading]=useState(true)
 const end=useRef<HTMLDivElement>(null)
 const load=useCallback(async()=>{
  if(!supabase)return
  const [m,a]=await Promise.all([
   supabase.from('order_messages').select('*').eq('order_id',orderId).order('created_at'),
   supabase.from('order_attachments').select('*').eq('order_id',orderId).order('created_at')
  ])
  if(m.error)setError(m.error.message);else {setMessages(m.data||[]);if(user?.id) await supabase.from('order_messages').update({read_at:new Date().toISOString()}).eq('order_id',orderId).is('read_at',null).neq('sender_id',user.id)}
  if(a.error)setError(a.error.message);else setFiles(a.data||[])
  setLoading(false)
 },[orderId,user?.id])
 useEffect(()=>{load()},[load])
 useEffect(()=>{
  if(!supabase)return
  const channel=supabase.channel(`order-chat-${orderId}`)
   .on('postgres_changes',{event:'*',schema:'public',table:'order_messages',filter:`order_id=eq.${orderId}`},()=>load())
   .on('postgres_changes',{event:'*',schema:'public',table:'order_attachments',filter:`order_id=eq.${orderId}`},()=>load())
   .subscribe()
  return()=>{supabase.removeChannel(channel)}
 },[orderId,load])
 useEffect(()=>{end.current?.scrollIntoView({behavior:'smooth'})},[messages,files])
 async function send(e:FormEvent){e.preventDefault();if(!supabase||!user||!body.trim())return;setBusy(true);setError('')
  const {error}=await supabase.from('order_messages').insert({order_id:orderId,sender_id:user.id,body:body.trim()})
  if(error)setError(error.message);else setBody('');setBusy(false)
 }
 async function attach(e:ChangeEvent<HTMLInputElement>){const f=e.target.files?.[0];e.target.value='';if(!f)return;setBusy(true);setProgress(0);setError('')
  try{await uploadPrivateFile(orderId,f,setProgress,admin?'final-deliveries':'client-uploads');await load()}catch(err:any){setError(err.message||'Não foi possível enviar o arquivo.')}finally{setBusy(false);setProgress(0)}
 }
 if(loading)return <div className="chatShell"><p>Carregando conversa…</p></div>
 return <section className="chatShell">
  <div className="chatTop"><div><b>Conversa do pedido</b><small>{admin?'Atendimento administrativo':'Atendimento Cauã Viral'} · atualizações em tempo real</small></div><span className="liveDot">● online</span></div>
  <div className="chatMessages">
   {messages.length===0&&files.length===0&&<div className="chatEmpty">Nenhuma mensagem ainda. Envie uma mensagem ou arquivo para iniciar o atendimento.</div>}
   {messages.map(m=><div key={m.id} className={`chatBubble ${m.sender_id===user?.id?'mine':'theirs'}`}><p>{m.body}</p><small>{m.sender_id===user?.id?'Você':admin?'Cliente':'Cauã Viral'} · {fmt(m.created_at)}</small></div>)}
   {files.map(f=><div key={f.id} className={`chatBubble fileBubble ${f.owner_id===user?.id?'mine':'theirs'}`}><FileItem file={f}/><small>{f.owner_id===user?.id?'Você':admin?'Cliente':'Cauã Viral'} · {fmt(f.created_at)}</small></div>)}
   <div ref={end}/>
  </div>
  {error&&<div className="notice error chatError">{error}</div>}
  {busy&&<div className="uploadProgress"><span>Enviando arquivo… {progress}%</span><progress value={progress} max="100"/></div>}
  <form className="chatComposer" onSubmit={send}>
   <label className="attachBtn" title="Anexar arquivo"><Paperclip size={19}/><input type="file" accept="image/*,video/mp4,video/webm,audio/*,.pdf,.txt,.zip,.docx,.xlsx" onChange={attach} disabled={busy}/></label>
   <input value={body} onChange={e=>setBody(e.target.value)} placeholder="Escreva sua mensagem…" maxLength={5000} disabled={busy}/>
   <button type="submit" className="sendBtn" disabled={busy||!body.trim()} aria-label="Enviar mensagem">{busy?<LoaderCircle className="spin"/>:<Send size={18}/>}</button>
  </form>
  <small className="chatLimits">Arquivos privados · limite atual: {Math.round(Number(import.meta.env.VITE_MAX_UPLOAD_BYTES||536870912)/1024/1024)} MB por arquivo</small>
 </section>
}
