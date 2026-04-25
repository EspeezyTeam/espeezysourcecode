import { NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabaseClient } from '@/utils/supabase/server'
import { checkBotId } from 'botid/server'
import { getStripeClient } from '@/utils/stripe'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const checkoutSchema = z.object({
  plan: z.enum(['pro', 'premium', 'lifetime']).default('pro'),
})

const PLAN_CONFIG: Record<z.infer<typeof checkoutSchema>['plan'], { priceEnvKey: string; mode: 'subscription' | 'payment'; label: string }> = {
  pro:      { priceEnvKey: 'STRIPE_PRICE_PRO_ID',      mode: 'subscription', label: 'Pro Scholar — $9/month' },
  premium:  { priceEnvKey: 'STRIPE_PRICE_PREMIUM_ID',  mode: 'subscription', label: 'Premium Scholar — $19/month' },
  lifetime: { priceEnvKey: 'STRIPE_PRICE_LIFETIME_ID', mode: 'payment',      label: 'Lifetime Founding Scholar — $149' },
}

export async function POST(req: Request) {
  let stripe
  try {
    stripe = getStripeClient()
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'Stripe is not configured'
    return NextResponse.json({ error: msg }, { status: 500 })
  }

  // BotID Verification
  const verification = await checkBotId()
  if (verification.isBot) {
    return NextResponse.json({ 
      error: 'Automated request detected. Please return to the dashboard and try again.' 
    }, { status: 403 })
  }

  const supabase = await createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
    .catch(() => ({ data: { user: null } }))

  if (!user) {
    return NextResponse.json({ error: 'Authentication required.' }, { status: 401 })
  }

  const body = await req.json().catch(() => null)
  const parsedBody = checkoutSchema.safeParse(body)
  if (!parsedBody.success) {
    return NextResponse.json({ error: 'Invalid plan selected.' }, { status: 422 })
  }

  const planKey = parsedBody.data.plan
  const config = PLAN_CONFIG[planKey]

  const priceId = process.env[config.priceEnvKey]
  // Fallback: legacy env keys for backwards compatibility
  const fallbackPriceId = planKey === 'pro'
    ? process.env.STRIPE_PRICE_SUBSCRIPTION_ID
    : planKey === 'lifetime'
    ? process.env.STRIPE_PRICE_ONE_TIME_ID
    : undefined

  const resolvedPriceId = priceId ?? fallbackPriceId
  const successUrl = process.env.STRIPE_SUCCESS_URL
  const cancelUrl = process.env.STRIPE_CANCEL_URL

  if (!resolvedPriceId || !successUrl || !cancelUrl) {
    return NextResponse.json({ error: 'Stripe is not configured correctly.' }, { status: 500 })
  }

  try {
    const session = await stripe.checkout.sessions.create({
      mode: config.mode,
      payment_method_types: ['card'],
      line_items: [{ price: resolvedPriceId, quantity: 1 }],
      customer_email: user.email ?? undefined,
      success_url: successUrl,
      cancel_url: cancelUrl,
      billing_address_collection: 'auto',
      allow_promotion_codes: true,
      metadata: {
        user_id: user.id,
        plan: planKey,
        product_label: config.label,
      },
    })

    if (!session.url) {
      throw new Error('Unable to initialize Stripe checkout session.')
    }

    return NextResponse.json({ url: session.url })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Stripe session creation failed.'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
