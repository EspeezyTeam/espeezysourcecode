import { NextResponse } from 'next/server'
import crypto from 'crypto'
import { createClient } from '@supabase/supabase-js'

export async function POST(req: Request) {
  // We initialize the client INSIDE the handler. Otherwise, Next.js tries to statically compile it 
  // during `npm run build` without environment variables, causing a Vercel Pipeline crash.
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  const supabase = createClient(supabaseUrl, supabaseServiceKey)

  try {
    const rawBody = await req.text()
    const signature = req.headers.get('x-hub-signature-256')
    const webhookSecret = process.env.GITHUB_WEBHOOK_SECRET

    if (!webhookSecret) {
      console.warn("GITHUB_WEBHOOK_SECRET is not set. Bypassing validation (NOT FOR PRODUCTION).")
    } else if (signature) {
      // Validate Payload
      const hmac = crypto.createHmac('sha256', webhookSecret)
      const digest = 'sha256=' + hmac.update(rawBody).digest('hex')
      if (signature !== digest) {
        return new NextResponse('Unauthorized: Invalid Signature', { status: 401 })
      }
    }

    const payload = JSON.parse(rawBody)

    // Only process push events with commits
    if (!payload.commits || payload.commits.length === 0) {
      return new NextResponse('No commits to process', { status: 200 })
    }

    const uuidRegex = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

    for (const commit of payload.commits) {
      const match = commit.message.match(uuidRegex)
      
      if (match) {
        const taskId = match[0]
        
        // 1. Fetch the Task to find who it's assigned to
        const { data: task, error: taskError } = await supabase
          .from('tasks')
          .select('assignees, status, is_coding_task')
          .eq('id', taskId)
          .single()

        if (!taskError && task?.is_coding_task) {
           // 2. Base Algorithmic Validity Engine (MVP scoring calculation)
           const impactScore = 15; // standard base reward
           
           // 3. Record the Commit mathematically
           await supabase.from('commits').insert([{
             hash: commit.id,
             message: commit.message,
             author_email: commit.author.email,
             task_id: taskId,
             impact_score: impactScore,
             lines_added: 0,
             lines_deleted: 0
           }])

           // 4. Update Task Status dynamically to Done
           await supabase.from('tasks').update({ status: 'Done' }).eq('id', taskId)

           // 5. Update Profile Score across ALL ACTIVE COLLABORATORS
           if (task.assignees && task.assignees.length > 0) {
              for (const userId of task.assignees) {
                 const { data: profile } = await supabase.from('profiles').select('total_score').eq('id', userId).single()
                 if (profile) {
                    await supabase.from('profiles').update({ total_score: profile.total_score + impactScore }).eq('id', userId)
                 }
              }
           }
        }
      }
    }

    return new NextResponse('Webhook processed successfully', { status: 200 })
    
  } catch (err: unknown) {
    console.error("Webhook Error:", err)
    return new NextResponse(`Server Error: ${(err instanceof Error ? err.message : String(err))}`, { status: 500 })
  }
}
