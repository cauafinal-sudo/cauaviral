import { createClient } from '@supabase/supabase-js'
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
export const supabase = url && key ? createClient(url, key, {auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}}) : null
export const WHATSAPP_URL = 'https://wa.me/553198660722'

// Mostra o erro REAL devolvido pela Edge Function (o supabase-js só diz "non-2xx status code")
export async function fnErrorMessage(error: any, data: any, fallback: string): Promise<string> {
  if (data?.error) return String(data.error)
  const res = error?.context
  if (res && typeof res.text === 'function') {
    const status = res.status
    const raw = await res.text().catch(() => '')
    let msg = raw
    try { const j = JSON.parse(raw); msg = j.error || j.message || raw } catch {}
    return `[${status ?? '?'}] ${msg || fallback}`
  }
  return error?.message || fallback
}
