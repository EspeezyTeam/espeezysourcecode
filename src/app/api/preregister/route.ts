import { NextResponse } from 'next/server'
import { createAdminClient } from '@/utils/supabase/server'
import { createHash } from 'crypto'
import { isValidEmail, sanitizeName, sanitizeText, checkBodySize, LIMITS } from '@/utils/sanitize'
import { sendPreregisterEmail } from '@/services/email'

export async function POST(req: Request) {
  try {
    // Reject oversized bodies before parsing
    if (!checkBodySize(req, 50_000)) {
      return NextResponse.json({ error: 'Payload too large.' }, { status: 413 })
    }

    const body = await req.json().catch(() => null)
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      return NextResponse.json({ error: 'Invalid request body.' }, { status: 400 })
    }

    const { email, fullName, institution, role, source, campaignRef } = body as Record<string, unknown>

    if (!isValidEmail(email)) {
      return NextResponse.json({ error: 'A valid email address is required.' }, { status: 400 })
    }

    // Sanitize all string fields
    const cleanEmail = (email as string).trim().toLowerCase().slice(0, LIMITS.MAX_EMAIL_LENGTH)
    const cleanFullName = sanitizeName(fullName)
    const cleanInstitution = sanitizeText(institution, 200)
    const cleanRole = typeof role === 'string' && ['student', 'educator', 'professional', 'other'].includes(role)
      ? role : 'student'
    const cleanSource = typeof source === 'string' ? sanitizeText(source, 50) : 'organic'
    const cleanCampaignRef = typeof campaignRef === 'string' ? sanitizeText(campaignRef, 100) : null

    // Hash IP for deduplication without storing raw IP
    const ipHeader = req.headers.get('x-forwarded-for') ?? req.headers.get('x-real-ip') ?? 'unknown'
    const ip = ipHeader.split(',')[0].trim()
    const ipHash = createHash('sha256').update(ip + (process.env.IP_HASH_SALT ?? 'fallback')).digest('hex').slice(0, 16)
    const userAgent = (req.headers.get('user-agent') ?? '').slice(0, 500)

    const supabase = await createAdminClient()

    const { error } = await supabase
      .from('pre_registrations')
      .insert({
        email: cleanEmail,
        full_name: cleanFullName || null,
        institution: cleanInstitution || null,
        role: cleanRole,
        source: cleanSource,
        campaign_ref: cleanCampaignRef,
        ip_hash: ipHash,
        user_agent: userAgent,
      })

    if (error) {
      // Unique constraint = already registered
      if (error.code === '23505') {
        return NextResponse.json({ success: true, message: 'You are already registered! We will be in touch.' })
      }
      console.error('[preregister] DB error:', error.code)
      return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 })
    }

    // Send confirmation email asynchronously (don't block the response)
    sendPreregisterEmail({ to: cleanEmail }).catch(err => {
      console.error('[preregister] Failed to send welcome email:', err)
    })

    // Fetch updated count
    const { data: countData } = await supabase.rpc('get_prereg_count')
    const count = countData ?? 0

    return NextResponse.json({
      success: true,
      message: 'You are on the list! We will notify you at launch.',
      count,
    })
  } catch (err) {
    console.error('[preregister] Unexpected error type:', typeof err)
    return NextResponse.json({ error: 'An unexpected error occurred.' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = await createAdminClient()
    const { data, error } = await supabase.rpc('get_prereg_count')
    if (error) throw error
    return NextResponse.json({ count: data ?? 0 })
  } catch (err) {
    return NextResponse.json({ count: 0 })
  }
}
