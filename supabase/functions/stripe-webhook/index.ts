import Stripe from 'npm:stripe@^22'
import { createClient } from 'npm:@supabase/supabase-js@^2'

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '')
const cryptoProvider = Stripe.createSubtleCryptoProvider()
const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
const response = (body: string, status = 200) => new Response(body, { status, headers: { 'Content-Type': 'text/plain' } })

async function applyCheckoutSession(session: Stripe.Checkout.Session, status: 'paid'|'pending'|'failed'|'cancelled') {
  const orderId = session.metadata?.order_id
  if (!orderId) throw new Error('Checkout session missing order_id metadata')
  const { data: order, error } = await admin.from('orders').select('id,user_id,amount,payment_status').eq('id', orderId).single()
  if (error || !order) throw new Error('Order not found for checkout session')
  const amountCents = Math.round(Number(order.amount) * 100)
  if (session.currency?.toLowerCase() !== 'brl' || session.amount_total !== amountCents) throw new Error('Session currency or amount mismatch')
  if (session.metadata?.user_id !== order.user_id) throw new Error('Checkout user/order mismatch')
  const finalStatus = status === 'paid' && session.payment_status !== 'paid' ? 'pending' : status
  const paymentStatus = finalStatus === 'paid' ? 'paid' : finalStatus === 'failed' ? 'failed' : finalStatus === 'cancelled' ? 'cancelled' : 'pending'
  const pi = typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id || null
  const { error: payErr } = await admin.from('stripe_payments').update({ status: finalStatus === 'paid' ? 'paid' : finalStatus === 'pending' ? 'pending' : finalStatus, stripe_payment_intent_id: pi, updated_at: new Date().toISOString(), paid_at: finalStatus === 'paid' ? new Date().toISOString() : null }).or(`stripe_checkout_session_id.eq.${session.id},and(order_id.eq.${order.id},attempt.eq.${session.metadata?.attempt || 0})`)
  if (payErr) throw payErr
  const orderUpdate: Record<string, unknown> = { payment_status: paymentStatus, stripe_checkout_session_id: session.id, stripe_payment_intent_id: pi, paid_at: finalStatus === 'paid' ? new Date().toISOString() : null }
  const { error: orderUpdateError } = await admin.from('orders').update(orderUpdate).eq('id', order.id)
  if (orderUpdateError) throw orderUpdateError
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return response('Method not allowed', 405)
  const signature = req.headers.get('stripe-signature') || ''
  const raw = await req.text()
  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(raw, signature, Deno.env.get('STRIPE_WEBHOOK_SECRET') || '', undefined, cryptoProvider)
  } catch (error) {
    console.error('Stripe signature check failed', error)
    return response('Invalid Stripe signature', 400)
  }
  try {
    const { data: prior } = await admin.from('stripe_webhook_events').select('processed_at').eq('event_id', event.id).maybeSingle()
    if (prior?.processed_at) return response('Already processed')
    await admin.from('stripe_webhook_events').upsert({ event_id: event.id, event_type: event.type, payload: event as unknown as Record<string, unknown>, last_error: null }, { onConflict: 'event_id', ignoreDuplicates: true })

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session
        const live = await stripe.checkout.sessions.retrieve(session.id)
        await applyCheckoutSession(live, live.payment_status === 'paid' ? 'paid' : 'pending')
        break
      }
      case 'checkout.session.async_payment_succeeded': {
        const session = event.data.object as Stripe.Checkout.Session
        const live = await stripe.checkout.sessions.retrieve(session.id)
        await applyCheckoutSession(live, 'paid')
        break
      }
      case 'checkout.session.async_payment_failed': {
        const session = event.data.object as Stripe.Checkout.Session
        await applyCheckoutSession(session, 'failed')
        break
      }
      case 'checkout.session.expired': {
        const session = event.data.object as Stripe.Checkout.Session
        await applyCheckoutSession(session, 'cancelled')
        break
      }
      case 'payment_intent.payment_failed': {
        const pi = event.data.object as Stripe.PaymentIntent
        const orderId = pi.metadata?.order_id
        const { data: payment } = await admin.from('stripe_payments').select('order_id').eq('stripe_payment_intent_id', pi.id).maybeSingle()
        const targetOrderId = payment?.order_id || orderId
        if (targetOrderId) {
          await admin.from('stripe_payments').update({ status: 'failed', stripe_payment_intent_id: pi.id, failure_reason: pi.last_payment_error?.message || 'Payment failed', updated_at: new Date().toISOString() }).eq('order_id', targetOrderId).in('status', ['creating','checkout_pending','pending'])
          await admin.from('orders').update({ payment_status: 'failed' }).eq('id', targetOrderId).neq('payment_status', 'paid')
        }
        break
      }
      case 'charge.refunded': {
        const charge = event.data.object as Stripe.Charge
        const piId = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id
        if (piId) {
          const { data: payment } = await admin.from('stripe_payments').select('order_id,amount_total').eq('stripe_payment_intent_id', piId).maybeSingle()
          if (payment) {
            const refunded = Number(charge.amount_refunded || 0)
            const full = refunded >= Number(payment.amount_total)
            await admin.from('stripe_payments').update({ amount_refunded: refunded, status: full ? 'refunded' : 'partially_refunded', updated_at: new Date().toISOString() }).eq('stripe_payment_intent_id', piId)
            if (full) await admin.from('orders').update({ payment_status: 'refunded' }).eq('id', payment.order_id)
          }
        }
        break
      }
      default: // Eventos não configurados são aceitos e registrados.
        break
    }
    await admin.from('stripe_webhook_events').update({ processed_at: new Date().toISOString(), last_error: null }).eq('event_id', event.id)
    return response('OK')
  } catch (error) {
    console.error('Webhook processing error', event.id, error)
    await admin.from('stripe_webhook_events').update({ last_error: error instanceof Error ? error.message : 'Unknown error' }).eq('event_id', event.id)
    return response('Processing error; Stripe should retry', 500)
  }
})
