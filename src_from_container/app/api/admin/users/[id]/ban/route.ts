import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, isAuthError, writeAuditLog } from '@/utils/admin-auth'

export const dynamic = 'force-dynamic'

const banSchema = z.object({
  action:     z.enum(['ban', 'unban']),
  reason:     z.string().min(5).max(1000).optional(),
  ban_type:   z.enum(['temporary', 'permanent']).optional().default('permanent'),
  expires_at: z.string().datetime().optional(),
})

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin()
  if (isAuthError(ctx)) return ctx

  const { id } = await params

  if (id === ctx.user.id) {
    return NextResponse.json({ error: 'Cannot ban your own account' }, { status: 400 })
  }

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = banSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { action, reason, ban_type, expires_at } = parsed.data

  if (action === 'ban') {
    if (!reason) {
      return NextResponse.json({ error: 'reason is required when banning a user' }, { status: 422 })
    }

    // Deactivate any existing active bans
    await ctx.svc
      .from('ban_records')
      .update({ is_active: false })
      .eq('user_id', id)
      .eq('is_active', true)

    // Create new ban record
    const { error: banErr } = await ctx.svc.from('ban_records').insert({
      user_id:    id,
      banned_by:  ctx.user.id,
      reason,
      ban_type,
      expires_at: expires_at ?? null,
    })
    if (banErr) return NextResponse.json({ error: banErr.message }, { status: 500 })

    // Update profile flags
    await ctx.svc
      .from('profiles')
      .update({ is_banned: true, account_status: 'banned', ban_reason: reason })
      .eq('id', id)

    await writeAuditLog(ctx.svc, {
      actor_id:      ctx.user.id,
      actor_email:   ctx.user.email,
      action:        'user.ban',
      resource_type: 'user',
      resource_id:   id,
      new_value:     { reason, ban_type, expires_at },
      severity:      'critical',
    })

    return NextResponse.json({ success: true, action: 'banned' })
  }

  // action === 'unban'
  await ctx.svc
    .from('ban_records')
    .update({ is_active: false, lifted_at: new Date().toISOString(), lifted_by: ctx.user.id })
    .eq('user_id', id)
    .eq('is_active', true)

  await ctx.svc
    .from('profiles')
    .update({ is_banned: false, account_status: 'active', ban_reason: null })
    .eq('id', id)

  await writeAuditLog(ctx.svc, {
    actor_id:      ctx.user.id,
    actor_email:   ctx.user.email,
    action:        'user.unban',
    resource_type: 'user',
    resource_id:   id,
    severity:      'warning',
  })

  return NextResponse.json({ success: true, action: 'unbanned' })
}
