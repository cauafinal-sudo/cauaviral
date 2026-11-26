import { FormEvent, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, LockKeyhole, Mail } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../auth/AuthContext'
function AuthNotice({children,kind='error'}:{children:React.ReactNode;kind?:'error'|'success'}){return <div className={`notice ${kind}`} role="status">{children}</div>}
export default function Login(){
 const [params]=useSearchParams();const navigate=useNavigate();const {user,configured}=useAuth();const [email,setEmail]=useState('');const [password,setPassword]=useState('');const [show,setShow]=useState(false);const [busy,setBusy]=useState(false);const [message,setMessage]=useState('')
 const rawRedirect=params.get('redirect');const redirect=rawRedirect&&rawRedirect.startsWith('/')&&!rawRedirect.startsWith('//')?rawRedirect:'/cliente';
 if(user)return <div className="container sec authWrap"><div className="authCard"><h1>Você já está conectado.</h1><Link className="btn" to="/cliente">Ir para minha área</Link></div></div>
 async function submit(e:FormEvent){e.preventDefault();setMessage('');if(!configured){setMessage('O Supabase ainda não está configurado. Siga as instruções no README e configure o arquivo .env.');return}if(!email.trim()||!password){setMessage('Informe e-mail e senha.');return}setBusy(true);const {error}=await supabase!.auth.signInWithPassword({email:email.trim(),password});setBusy(false);if(error){setMessage(error.message.includes('Invalid login credentials')?'E-mail ou senha incorretos.':error.message);return}navigate(redirect,{replace:true})}
 return <div className="container sec authWrap"><div className="authCard"><div className="authMark">CV</div><span className="eyebrow">Área do cliente</span><h1>Bem-vindo de volta</h1><p>Entre para acompanhar seus pedidos e contratar serviços.</p>
 {params.get('setup')&&<AuthNotice>Autenticação ainda não configurada. Preencha as variáveis do Supabase para ativar as contas.</AuthNotice>}
 {message&&<AuthNotice>{message}</AuthNotice>}
 <form onSubmit={submit} className="authForm"><label>E-mail<input type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@email.com" required /></label><label>Senha<div className="passwordField"><input type={show?'text':'password'} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="Sua senha" required/><button type="button" className="reveal" onClick={()=>setShow(!show)} aria-label={show?'Ocultar senha':'Mostrar senha'}>{show?<EyeOff/>:<Eye/>}</button></div></label><button className="btn full" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></form>
 <Link className="textLink" to="/recuperar-senha">Esqueci minha senha</Link><div className="authBottom">Ainda não tem conta? <Link to={`/cadastro?redirect=${encodeURIComponent(redirect)}`}>Criar cadastro</Link></div><Link className="back" to="/">← Voltar ao site</Link></div></div>
}
