import { supabase } from './supabase'

export const MAX_UPLOAD_BYTES = Number(import.meta.env.VITE_MAX_UPLOAD_BYTES || 536870912)
const allowed = new Set([
  'image/jpeg','image/png','image/webp','image/gif',
  'video/mp4','video/webm','audio/mpeg','audio/mp4','audio/wav','audio/ogg','audio/webm',
  'application/pdf','text/plain','application/zip',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
])
export function validateUpload(file: File) {
  if (!allowed.has(file.type)) throw new Error('Formato não permitido. Envie imagem, vídeo, áudio ou documento compatível.')
  if (file.size > MAX_UPLOAD_BYTES) throw new Error(`Arquivo acima do limite de ${Math.round(MAX_UPLOAD_BYTES/1024/1024)} MB.`)
}
export async function uploadPrivateFile(orderId: string, file: File, onProgress: (n:number)=>void, bucket='client-uploads') {
  if (!supabase) throw new Error('Supabase não configurado.')
  validateUpload(file)
  const {data:{session}} = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Sua sessão expirou. Entre novamente.')
  const path = `${orderId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.\-]+/g,'_')}`
  await new Promise<void>((resolve,reject)=>{
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${bucket}/${path.split('/').map(encodeURIComponent).join('/')}`)
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`)
    xhr.setRequestHeader('apikey', import.meta.env.VITE_SUPABASE_ANON_KEY)
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream')
    xhr.setRequestHeader('x-upsert','false')
    xhr.upload.onprogress = e => { if(e.lengthComputable) onProgress(Math.round(e.loaded/e.total*100)) }
    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject(new Error(`Falha no upload (${xhr.status}): ${xhr.responseText || 'verifique as permissões do Storage'}`))
    xhr.onerror = () => reject(new Error('Falha de conexão durante o envio.'))
    xhr.onabort = () => reject(new Error('Envio cancelado.'))
    xhr.send(file)
  })
  const {error} = await supabase.from('order_attachments').insert({
    order_id: orderId, owner_id: session.user.id, storage_path: path, bucket_id: bucket,
    original_name: file.name, mime_type: file.type, size_bytes: file.size
  })
  if(error) throw error
  return path
}
export async function getPrivateFileUrl(path:string, bucket='client-uploads') {
  if(!supabase) throw new Error('Supabase não configurado.')
  const {data,error}=await supabase.storage.from(bucket).createSignedUrl(path, 300)
  if(error) throw error
  return data.signedUrl
}
