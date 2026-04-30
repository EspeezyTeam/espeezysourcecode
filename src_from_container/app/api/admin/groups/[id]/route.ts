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

  const { data: group, error } = await ctx.svc
    .from('groups')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !group) return NextResponse.json({ error: 'Group not found' }, { status: 404 })

  // Member count
  const { count: memberCount } = await ctx.svc
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)

  // Task count
  const { count: taskCount } = await ctx.svc
    .from('tasks')
    .select('*', { count: 'exact', head: true })
    .eq('group_id', id)

  return NextResponse.json({ group, memberCount: memberCount ?? 0, taskCount: taskCount ?? 0 })
}

const patchSchema = z.object({
  status:       z.enum(['active', 'archived', 'suspended']).optional(),
  featured:     z.boolean().optional(),
  admin_notes:  z.string().max(2000).optional(),
  capacity:     z.number().int().min(1).max(10000).optional(),
  description:  z.string().max(2000).optional(),
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

  const { data: oldGroup } = await ctx.svc
    .from('groups')
    .select('status, featured, admin_notes')
    .eq('id', id)
    .single()

  const { data: updated, error } = await ctx.svc
    .from('groups')
    .update(parsed.data)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(ctx.svc, {
    actor_id:      ctx.user.id,
    actor_email:   ctx.user.email,
    action:        'group.update',
    resource_type: 'group',
    resource_id:   id,
    old_value:     oldGroup,
    new_value:     parsed.data,
    severity:      parsed.data.status === 'suspended' ? 'warning' : 'info',
  })

  return NextResponse.json({ group: updated })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await requireAdmin()
  if (isAuthError(ctx)) return ctx

  const { id } = await params

  const { data: group } = await ctx.svc
    .from('groups')
    .select('name, owner_id')
    .eq('id', id)
    .single()

  const { error } = await ctx.svc.from('groups').delete().eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await writeAuditLog(ctx.svc, {
    actor_id:      ctx.user.id,
    actor_email:   ctx.user.email,
    action:        'group.delete',
    resource_type: 'group',
    resource_id:   id,
    old_value:     group,
    severity:      'critical',
  })

  return NextResponse.json({ success: true })
}
