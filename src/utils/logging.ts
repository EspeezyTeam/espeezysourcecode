import { createBrowserSupabaseClient } from './supabase/client'
import { ActionType } from '@/types/ui'

export async function logActivity(
  userId: string, 
  groupId: string | null, 
  actionType: ActionType, 
  description: string, 
  metadata: Record<string, unknown> = {},
  notifyUserId?: string // Optional: targeted notification
) {
  const supabase = createBrowserSupabaseClient()
  
  // 1. Validation & Hardening
  // Ensure group_id is a valid UUID (standard format) or null.
  // This prevents 'system' or other non-UUID strings from triggering database errors.
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  const validatedGroupId = (groupId && uuidRegex.test(groupId)) ? groupId : null

  // Ensure we are logging as the current authenticated user to satisfy RLS auth.uid() = user_id
  const { data: { user } } = await supabase.auth.getUser()
  const validatedUserId = user?.id || userId

  // 1. Audit Log Entry
  const { error: logError } = await supabase
    .from('activity_log')
    .insert({
      user_id: validatedUserId,
      group_id: validatedGroupId,
      action_type: actionType,
      description,
      metadata
    })

  if (logError) {
    console.error('Audit Logging Failed:', JSON.stringify({
      action: actionType,
      error: logError.message,
      details: logError.details,
      code: logError.code
    }, null, 2))
  }

  // 2. Real-time Notification Trigger (if applicable)
  if (notifyUserId) {
    await supabase.from('notifications').insert({
      user_id: notifyUserId,
      type: actionType,
      title: actionType.replace('_', ' ').toUpperCase(),
      message: description,
      link: '/dashboard'
    })
  } else if (actionType === 'task_created' || actionType === 'privacy_toggled') {
    // Broadcast notification to group members (conceptual)
    // For a real app, we'd use an Edge Function to scatter-gather.
    // For now, we target the current group if needed.
  }
}
