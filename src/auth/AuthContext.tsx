import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

type AuthState = { session: Session | null; user: User | null; loading: boolean; configured: boolean }
const AuthContext = createContext<AuthState>({ session: null, user: null, loading: true, configured: !!supabase })
export function AuthProvider({children}:{children:ReactNode}) {
 const [state,setState]=useState<AuthState>({session:null,user:null,loading:true,configured:!!supabase})
 useEffect(()=>{
  if(!supabase){setState({session:null,user:null,loading:false,configured:false});return}
  supabase.auth.getSession().then(({data})=>setState({session:data.session,user:data.session?.user??null,loading:false,configured:true})).catch(()=>setState({session:null,user:null,loading:false,configured:true}))
  const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,session)=>setState({session,user:session?.user??null,loading:false,configured:true}))
  return ()=>subscription.unsubscribe()
 },[])
 return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>
}
export const useAuth=()=>useContext(AuthContext)
