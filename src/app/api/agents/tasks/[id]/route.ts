import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const apiKey = req.headers.get('x-agent-key');
  if (!apiKey || apiKey !== process.env.AGENT_API_KEY) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { id: agentId } = await params;
  if (!agentId) {
    return NextResponse.json({ error: 'agentId required' }, { status: 400 });
  }

  const admin = await createAdminClient();

  let resolvedId = agentId;
  if (!/^[0-9a-f-]{36}$/.test(agentId)) {
    const { data: agent } = await admin
      .from('agents')
      .select('id')
      .ilike('name', agentId)
      .single();
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 });
    }
    resolvedId = agent.id;
  }

  interface AgentTask {
    id: string;
    title: string;
    description: string;
    priority: string;
    status: string;
    depends_on: string[] | null;
    output_artifacts: unknown;
    logs: string | null;
    created_at: string;
  }

  const { data: rawTasks, error } = await admin
    .from('agent_tasks')
    .select('id, title, description, priority, status, depends_on, output_artifacts, logs, created_at')
    .eq('assigned_agent_id', resolvedId)
    .in('status', ['not_started', 'in_progress'])
    .order('priority', { ascending: false })
    .order('created_at', { ascending: true })
    .limit(10);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const tasks = (rawTasks ?? []) as AgentTask[];
  const allDependencyIds = [...new Set(tasks.flatMap(t => t.depends_on ?? []))];
  let completedDeps: string[] = [];

  if (allDependencyIds.length > 0) {
    const { data: doneTasks } = await admin
      .from('agent_tasks')
      .select('id')
      .in('id', allDependencyIds)
      .eq('status', 'done');
    completedDeps = (doneTasks as { id: string }[] | null)?.map(t => t.id) ?? [];
  }

  const readyTasks = tasks.filter(task =>
    (task.depends_on ?? []).every(depId => completedDeps.includes(depId))
  );

  return NextResponse.json({ tasks: readyTasks, total: readyTasks.length });
}
