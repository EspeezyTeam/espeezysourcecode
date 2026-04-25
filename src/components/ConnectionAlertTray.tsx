'use client'

import { useState, useEffect } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { UserPlus, X, Check, ExternalLink, RefreshCw } from 'lucide-react'
import { useNotifications } from './NotificationProvider'
import Link from 'next/link'

export default function ConnectionAlertTray() {
  const [requests, setRequests] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [processingId, setProcessingId] = useState<string | null>(null)
  const supabase = createBrowserSupabaseClient()
  const { addToast } = useNotifications()

  const fetchRequests = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data, error } = await supabase
      .from('user_connections')
      .select('*, profiles!user_connections_user_id_fkey(id, full_name, avatar_url, course_name)')
      .eq('target_id', user.id)
      .eq('status', 'pending')

    if (error) {
      console.error('Error fetching connection requests:', error)
    } else {
      setRequests(data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    queueMicrotask(() => {
      void fetchRequests()
    })

    // Real-time subscription for new requests
    const channel = supabase
      .channel('connection_requests_sync')
      .on(
        'postgres_changes',
        { 
          event: '*', 
          schema: 'public', 
          table: 'user_connections'
        },
        () => fetchRequests()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [])

  const handleAction = async (requestId: string, senderId: string, action: 'accept' | 'decline') => {
    setProcessingId(requestId)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      if (action === 'accept') {
        const { error } = await supabase
          .from('user_connections')
          .update({ status: 'connected' })
          .eq('id', requestId)

        if (error) throw error

        // Notify sender
        await supabase.from('notifications').insert({
          user_id: senderId,
          type: 'connection_accepted',
          title: 'Connection Established',
          message: 'Your connection request was accepted.',
          link: `/dashboard/network/profile/${user.id}`
        })

        addToast('Connected!', 'You are now connected with a new specialist.', 'success')
      } else {
        const { error } = await supabase
          .from('user_connections')
          .delete()
          .eq('id', requestId)

        if (error) throw error
        addToast('Request Ignored', 'The connection request has been removed.', 'info')
      }

      // Mark any associated notifications as read
      const { data: notifs } = await supabase
        .from('notifications')
        .select('id')
        .eq('user_id', user.id)
        .eq('type', 'connection_request')
        .contains('metadata', { sender_id: senderId })

      if (notifs && notifs.length > 0) {
        await supabase
          .from('notifications')
          .update({ read: true })
          .in('id', notifs.map(n => n.id))
      }

      await fetchRequests()
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Action failed'
      addToast('Sync Error', message, 'error')
    } finally {
      setProcessingId(null)
    }
  }

  if (loading || requests.length === 0) return null

  return (
    <div className="connection-tray-container" style={{ margin: '0 0 var(--gap-md) 0', animation: 'slideInDown 0.4s cubic-bezier(0.23, 1, 0.32, 1)' }}>
      {requests.map((req) => (
        <div 
          key={req.id} 
          style={{ 
            background: 'rgba(var(--brand-rgb), 0.05)', 
            border: '1px solid var(--brand)', 
            borderRadius: '16px', 
            padding: '0.75rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '1rem',
            flexWrap: 'wrap',
            boxShadow: '0 4px 15px rgba(var(--brand-rgb), 0.1)',
            marginBottom: requests.length > 1 ? '0.5rem' : 0
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1 }}>
            <div style={{ padding: '8px', background: 'var(--brand)', color: 'white', borderRadius: '10px' }}>
              <UserPlus size={18} />
            </div>
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 900, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                Pending Connection Request
                <span className="pulse-pill" style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--brand)' }} />
              </div>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-sub)' }}>
                <strong>{req.profiles?.full_name || 'A student'}</strong> wants to connect for collaboration.
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
             <Link 
               href={`/dashboard/network/profile/${req.user_id}`}
               style={{ 
                 padding: '0.5rem', 
                 borderRadius: '8px', 
                 color: 'var(--text-sub)', 
                 background: 'var(--bg-sub)',
                 border: '1px solid var(--border)',
                 display: 'flex',
                 alignItems: 'center',
                 justifyContent: 'center',
                 transition: 'all 0.2s'
               }}
               title="View Profile"
             >
                <ExternalLink size={16} />
             </Link>
             
             <button 
               onClick={() => handleAction(req.id, req.user_id, 'decline')}
               disabled={processingId === req.id}
               style={{ 
                 padding: '0.5rem 1rem', 
                 borderRadius: '10px', 
                 background: 'var(--bg-sub)', 
                 color: 'var(--text-sub)',
                 border: '1px solid var(--border)',
                 fontSize: '0.75rem',
                 fontWeight: 800,
                 cursor: 'pointer'
               }}
             >
               {processingId === req.id ? '...' : 'Ignore'}
             </button>

             <button 
               onClick={() => handleAction(req.id, req.user_id, 'accept')}
               disabled={processingId === req.id}
               style={{ 
                 padding: '0.5rem 1.25rem', 
                 borderRadius: '10px', 
                 background: 'var(--brand)', 
                 color: 'white',
                 border: 'none',
                 fontSize: '0.75rem',
                 fontWeight: 900,
                 cursor: 'pointer',
                 boxShadow: '0 4px 10px rgba(var(--brand-rgb), 0.2)',
                 display: 'flex',
                 alignItems: 'center',
                 gap: '0.4rem'
               }}
             >
               {processingId === req.id ? <RefreshCw size={14} className="spin" /> : <Check size={16} />}
               Accept Request
             </button>
          </div>
        </div>
      ))}

      <style jsx>{`
        @keyframes slideInDown {
          from { transform: translateY(-20px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
        .spin { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
