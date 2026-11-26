import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@^2'

const cors = {
  'Access-Control-Allow-Origin': Deno.env.get('CHECKOUT_ALLOWED_ORIGIN') || 'https://cauaviral.com',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '')
const supabaseUrl = Deno.env.get('SUPABASE_URL')!
const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const anonKey = Deno.env.get('SUPABASE_ANON_KEY')!
const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  const origin = req.headers.get('origin')
  const allowedOrigin = Deno.env.get('CHECKOUT_ALLOWED_ORIGIN') || 'https://cauaviral.com'
  if (origin && origin !== allowedOrigin) return json({ error: 'Origin not allowed.' }, 403)
  if (req.method !== 'POST') return json({ error: 'Method not allowed' }, 405)
  try {
    const bearer = req.headers.get('Authorization') || ''
    if (!bearer.startsWith('Bearer ')) return json({ error: 'Faça login para continuar.' }, 401)
    const token = bearer.slice(7)
    const authClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false }, global: { headers: { Authorization: bearer } } })
    const { data: authData, error: authError } = await authClient.auth.getUser(token)
    if (authError || !authData.user) return json({ error: 'Sessão inválida ou expirada.' }, 401)
    const { order_id } = await req.json()
    if (typeof order_id !== 'string') return json({ error: 'order_id obrigatório.' }, 400)

    const { data: order, error: orderError } = await admin.from('orders').select('id,user_id,service_slug,service_name,amount,quantity,payment_status').eq('id', order_id).single()
    if (orderError || !order) return json({ error: 'Pedido não encontrado.' }, 404)
    if (order.user_id !== authData.user.id) return json({ error: 'Você não tem acesso a este pedido.' }, 403)
    if (order.payment_status === 'paid') return json({ error: 'Este pedido já está pago.' }, 409)
    if (order.payment_status === 'refunded') return json({ error: 'Pedido reembolsado não pode ser cobrado novamente.' }, 409)

    const { data: service, error: serviceError } = await admin.from('service_catalog').select('service_name,amount,active').eq('slug', order.service_slug).single()
    if (serviceError || !service?.active) return json({ error: 'Serviço indisponível.' }, 400)
    const qty = Math.max(1, Math.min(100, Number(order.quantity || 1)))
    const cents = Math.round(Number(service.amount) * qty * 100)
    if (Math.round(Number(order.amount) * 100) !== cents) return json({ error: 'Valor do pedido não confere com o catálogo. Atualize o pedido ou fale com suporte.' }, 409)

    const { data: latest } = await admin.from('stripe_payments').select('*').eq('order_id', order.id).order('attempt', { ascending: false }).limit(1).maybeSingle()
    if (latest?.stripe_checkout_session_id && ['checkout_pending','pending'].includes(latest.status)) {
      const existing = await stripe.checkout.sessions.retrieve(latest.stripe_checkout_session_id)
      if (existing.status === 'open' && existing.url) return json({ checkout_url: existing.url, reused: true })
      if (existing.payment_status === 'paid') return json({ error: 'Pagamento já confirmado. Atualize a página do pedido.' }, 409)
      await admin.from('stripe_payments').update({ status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', latest.id)
    }

    const { data: reserved, error: reserveError } = await admin.rpc('reserve_stripe_attempt', { p_order_id: order.id })
    if (reserveError || !reserved?.length) return json({ error: reserveError?.message || 'Não foi possível iniciar a cobrança.' }, 500)
    const attempt = reserved[0]
    const origin = Deno.env.get('CHECKOUT_ALLOWED_ORIGIN') || 'https://cauaviral.com'
    const session = await stripe.checkout.sessions.create({
      mode: 'payment', currency: 'brl',
      line_items: [{ quantity: qty, price_data: { currency: 'brl', unit_amount: Math.round(Number(service.amount) * 100), product_data: { name: service.service_name } } }],
      customer_email: authData.user.email || undefined,
      metadata: { order_id: order.id, user_id: authData.user.id, service_slug: order.service_slug, attempt: String(attempt.attempt_no) },
      payment_intent_data: { metadata: { order_id: order.id, user_id: authData.user.id, service_slug: order.service_slug } },
      success_url: `${origin}/cliente/pedidos/${order.id}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/cliente/pedidos/${order.id}?checkout=cancelled`,
    }, { idempotencyKey: attempt.idempotency_key })
    const { error: saveError } = await admin.from('stripe_payments').update({ status: 'checkout_pending', stripe_checkout_session_id: session.id, checkout_url: session.url, updated_at: new Date().toISOString() }).eq('id', attempt.payment_row_id).eq('status', 'creating')
    if (saveError) throw saveError
    await admin.from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', order.id)
    if (!session.url) return json({ error: 'Stripe não retornou a URL do checkout.' }, 502)
    return json({ checkout_url: session.url })
  } catch (error) {
    console.error('checkout-start failed', error)
    return json({ error: error instanceof Error ? error.message : 'Erro ao iniciar pagamento.' }, 500)
  }
})
