import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, isAuthError, writeAuditLog } from '@/utils/admin-auth'

export const dynamic = 'force-dynamic'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin()
  if (isAuthError(ctx)) return ctx

  const { id } = await params

  const { data: user, error } = await ctx.svc
    .from('profiles')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !user) return NextResponse.json({ error: 'User not found' }, { status: 404 })

  // Fetch active ban record if any
  const { data: activeBan } = await ctx.svc
    .from('ban_records')
    .select('*')
    .eq('user_id', id)
    .eq('is_active', true)
    .maybeSingle()

  return NextResponse.json({ user, activeBan: activeBan ?? null })
}

const patchSchema = z.object({
  role:             z.enum(['admin', 'team_leader', 'moderator', 'member']).optional(),
  subscription_plan: z.enum(['free', 'pro', 'premium', 'lifetime']).optional(),
  account_status:   z.enum(['active', 'suspended', 'banned', 'pending_verification']).optional(),
  notes:            z.string().max(2000).optional(),
  full_name:        z.string().min(1).max(200).optional(),
})

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin()
  if (isAuthError(ctx)) return ctx

  const { id } = await params

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const parsed = patchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const updates = parsed.data
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 422 })
  }

  // Fetch current values for audit trail
  const { data: oldProfile } = await ctx.svc
    .from('profiles')
    .select('role, subscription_plan, account_status, notes, full_name')
    .eq('id', id)
    .single()

  const { data: updated, error } = await ctx.svc
    .from('profiles')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(ctx.svc, {
    actor_id:      ctx.user.id,
    actor_email:   ctx.user.email,
    action:        'user.update',
    resource_type: 'user',
    resource_id:   id,
    old_value:     oldProfile,
    new_value:     updates,
    severity:      updates.role ? 'warning' : 'info',
  })

  return NextResponse.json({ user: updated })
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin()
  if (isAuthError(ctx)) return ctx

  const { id } = await params

  // Prevent self-deletion
  if (id === ctx.user.id) {
    return NextResponse.json({ error: 'Cannot delete your own account' }, { status: 400 })
  }

  const { data: profile } = await ctx.svc
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', id)
    .single()

  // Delete from auth (cascades to profiles via trigger)
  const { error } = await ctx.svc.auth.admin.deleteUser(id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(ctx.svc, {
    actor_id:      ctx.user.id,
    actor_email:   ctx.user.email,
    action:        'user.delete',
    resource_type: 'user',
    resource_id:   id,
    old_value:     profile,
    severity:      'critical',
  })

  return NextResponse.json({ success: true })
}
