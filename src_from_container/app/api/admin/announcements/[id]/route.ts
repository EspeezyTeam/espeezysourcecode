import { NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAdmin, isAuthError, writeAuditLog } from '@/utils/admin-auth'

export const dynamic = 'force-dynamic'

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

  const schema = z.object({
    title:     z.string().min(1).max(200).optional(),
    body:      z.string().min(1).max(5000).optional(),
    type:      z.enum(['info', 'warning', 'maintenance', 'feature', 'critical']).optional(),
    target:    z.enum(['all', 'pro', 'premium', 'admin']).optional(),
    is_active: z.boolean().optional(),
    starts_at: z.string().datetime().optional(),
    ends_at:   z.string().datetime().optional(),
  })

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const { data: updated, error } = await ctx.svc
    .from('system_announcements')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(ctx.svc, {
    actor_id:      ctx.user.id,
    actor_email:   ctx.user.email,
    action:        'announcement.update',
    resource_type: 'announcement',
    resource_id:   id,
    new_value:     parsed.data,
    severity:      'info',
  })

  return NextResponse.json({ announcement: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin()
  if (isAuthError(ctx)) return ctx

  const { id } = await params

  const { error } = await ctx.svc.from('system_announcements').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(ctx.svc, {
    actor_id:      ctx.user.id,
    actor_email:   ctx.user.email,
    action:        'announcement.delete',
    resource_type: 'announcement',
    resource_id:   id,
    severity:      'warning',
  })

  return NextResponse.json({ success: true })
}
