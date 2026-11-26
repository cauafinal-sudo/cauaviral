import {useEffect,useState} from 'react'
import type {ReactNode} from 'react'
import {Navigate} from 'react-router-dom'
import {supabase} from '../lib/supabase'
import {useAuth} from '../auth/AuthContext'
export default function AdminRoute({children}:{children:ReactNode}){const {user,loading}=useAuth();const [role,setRole]=useState<string|null>(null),[checking,setChecking]=useState(true)
 useEffect(()=>{let live=true;if(!user){setChecking(false);return}supabase?.from('profiles').select('role').eq('id',user.id).maybeSingle().then(({data})=>{if(live){setRole(data?.role||null);setChecking(false)}});return()=>{live=false}},[user])
 if(loading||checking)return <div className="container sec">Verificando acesso administrativo…</div>
 if(!user)return <Navigate to="/entrar" replace/>
 return role==='admin'?<>{children}</>:<Navigate to="/cliente" replace/>
}
