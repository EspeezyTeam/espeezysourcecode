import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const CompleteSchema = z.object({
  status: z.literal('done').or(z.literal('blocked')),
  output_artifacts: z.array(z.record(z.string(), z.unknown())).optional().default([]),
  logs: z.string().max(10000).optional().default(''),
  tests_passed: z.number().int().min(0).optional(),
  tests_failed: z.number().int().min(0).optional(),
  security_issues: z.array(z.string()).optional(),
  lighthouse: z.object({ performance: z.number(), accessibility: z.number() }).optional(),
  build_passed: z.boolean().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = req.headers.get('x-agent-key');
  if (!apiKey || apiKey !== process.env.AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: taskId } = await params;
  if (!taskId) return NextResponse.json({ error: 'taskId required' }, { status: 400 });

  const body = await req.json().catch(() => null);
  const parse = CompleteSchema.safeParse(body);
  if (!parse.success) return NextResponse.json({ error: parse.error.flatten() }, { status: 400 });

  const { status, output_artifacts, logs, ...resultFields } = parse.data;
  const admin = await createAdminClient();

  const { data: task, error: fetchError } = await admin
    .from('agent_tasks').select('id, assigned_agent_id, status').eq('id', taskId).single();

  if (fetchError || !task) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
  if (task.status === 'done') return NextResponse.json({ error: 'Task already completed' }, { status: 409 });

  const artifacts = [
    ...(output_artifacts as object[]),
    ...(Object.keys(resultFields).length > 0 ? [{ type: 'result_summary', ...resultFields }] : []),
  ];

  const { error: updateError } = await admin.from('agent_tasks').update({
    status, output_artifacts: artifacts, logs: logs || '',
    completed_at: status === 'done' ? new Date().toISOString() : null,
  }).eq('id', taskId);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  if (status === 'done' && task.assigned_agent_id) {
    await admin.rpc('increment_agent_tasks', { agent_id: task.assigned_agent_id }).catch(() => {
      admin.from('agents').select('tasks_completed').eq('id', task.assigned_agent_id).single()
        .then(({ data }: { data: { tasks_completed: number | null } | null }) => {
          if (data) admin.from('agents').update({ tasks_completed: (data.tasks_completed ?? 0) + 1 }).eq('id', task.assigned_agent_id);
        });
    });
  }

  return NextResponse.json({ ok: true, task_id: taskId, status });
}
