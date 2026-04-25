'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { Profile } from '@/types/database'
import { Users, UserPlus, Check, ExternalLink, Shield, Sparkles } from 'lucide-react'
import { getFlagComponent } from '@/utils/geo'

interface CollaboratorsListProps {
  currentGroupId: string | null;
  onViewProfile: (profile: Profile) => void;
}

export default function CollaboratorsList({ currentGroupId, onViewProfile }: CollaboratorsListProps) {
  const [collaborators, setCollaborators] = useState<Profile[]>([])
  const [personalNetwork, setPersonalNetwork] = useState<Profile[]>([])
  const [suggested, setSuggested] = useState<Profile[]>([])
  const [connections, setConnections] = useState<Set<string>>(new Set())
  const [loading, setLoading] = useState(true)
  const supabase = createBrowserSupabaseClient()

  const fetchCollaborators = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    // Use either the passed prop or the profile's group_id
    const groupId = currentGroupId
    
    if (!user || !groupId) {
      return
    }

    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('group_id', groupId)
      .neq('id', user.id)

    if (data) {
      setCollaborators(data as Profile[])
    }
  }, [supabase, currentGroupId])

  const fetchSuggested = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Fetch users NOT in the current group and NOT already connected
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .neq('id', user.id)
      .not('group_id', 'eq', currentGroupId || '00000000-0000-0000-0000-000000000000')
      .limit(6)

    if (data) setSuggested(data as Profile[])
  }, [supabase, currentGroupId])

  const fetchConnections = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // 1. Fetch connected IDs for fast lookup
    const { data: connData } = await supabase
      .from('user_connections')
      .select('user_id, target_id')
      .or(`user_id.eq.${user.id},target_id.eq.${user.id}`)
      .eq('status', 'connected')

    if (connData) {
      const ids = connData.map((c: { user_id: string; target_id: string }) => c.user_id === user.id ? c.target_id : c.user_id)
      const uniqueIds = Array.from(new Set(ids))
      setConnections(new Set(uniqueIds))

      // 2. Fetch full profiles for these connections (Global Discovery unblocked by RLS)
      if (uniqueIds.length > 0) {
        const { data: profiles, error } = await supabase
          .from('profiles')
          .select('*')
          .in('id', uniqueIds)
        
        if (profiles) {
          setPersonalNetwork(profiles as Profile[])
        }
      } else {
        setPersonalNetwork([])
      }
    }
  }, [supabase])

  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      await Promise.all([
        fetchCollaborators(),
        fetchConnections(),
        fetchSuggested()
      ])
      if (active) setLoading(false)
    }

    void load()
    
    // Subscribe to connection updates
    const channel = supabase.channel('network_updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'user_connections' }, () => {
        void fetchConnections()
      })
      .subscribe()

    return () => { 
      active = false
      supabase.removeChannel(channel)
    }
  }, [currentGroupId, fetchCollaborators, fetchConnections, fetchSuggested])

  const handleConnect = async (targetId: string) => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    // Create a connection request/approval flow
    // For immediate addition in this simplified UI flow, we upsert to connected
    const { error } = await supabase
      .from('user_connections')
      .upsert({ user_id: user.id, target_id: targetId, status: 'connected' })

    if (!error) {
      setConnections(prev => new Set([...Array.from(prev), targetId]))
      void fetchConnections() // Refresh network list
      
      // Send notification to target
      await supabase.from('notifications').insert({
        user_id: targetId,
        type: 'connection_request',
        title: 'Network Expansion',
        message: `${user.user_metadata?.full_name || 'A scholar'} has established a synchronization link with you.`,
        metadata: { sender_id: user.id }
      })
    }
  }

  const renderUserCard = (collab: Profile) => {
    const isConnected = connections.has(collab.id)
    const isTeammate = collab.group_id === currentGroupId

    return (
      <div 
        key={collab.id}
        style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.6rem', 
          padding: '0.5rem 0', 
          borderBottom: '1px solid rgba(var(--text-main-rgb), 0.05)',
          transition: 'all 0.2s',
          animation: 'fadeIn 0.3s ease-out'
        }}
      >
        <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--brand)', overflow: 'hidden', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 900, fontSize: '0.7rem' }}>
          {collab.avatar_url ? (
            <img src={collab.avatar_url} alt="avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            collab.full_name?.[0] || '?'
          )}
        </div>
        
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '0.8rem', fontWeight: 800, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            {collab.full_name || 'Anonymous'}
            {(() => {
              const Flag = getFlagComponent((collab as { country_code?: string }).country_code)
              return Flag ? <div style={{ width: '14px', height: '10px', borderRadius: '2px', overflow: 'hidden' }}><Flag /></div> : null
            })()}
          </div>
          <div style={{ fontSize: '0.6rem', color: 'var(--text-sub)', display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700, textTransform: 'uppercase' }}>
             {isTeammate && <span style={{ color: 'var(--brand)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}><Users size={10} /> Team</span>}
             <span>{collab.rank || 'Scholar'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '0.25rem' }}>
          <button 
            onClick={() => onViewProfile(collab)}
            className="panel-tool"
            style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '6px' }}
          >
            <ExternalLink size={12} />
          </button>
          {!isConnected && (
            <button 
              onClick={() => handleConnect(collab.id)}
              style={{ 
                width: '28px', height: '28px', borderRadius: '6px', border: 'none', 
                background: 'var(--brand)', color: 'white', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center'
              }}
            >
              <UserPlus size={12} />
            </button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="collaborators-container" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      
      {/* 1. TEAM SECTION */}
      <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <Users size={16} color="var(--brand)" />
          <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Team Collaborators</h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[1, 2].map(i => <div key={i} className="skeleton" style={{ height: '32px', borderRadius: '6px' }} />)}
          </div>
        ) : collaborators.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '1rem', border: '1px dashed var(--border)', borderRadius: '12px' }}>
            <span style={{ fontSize: '0.65rem', color: 'var(--text-sub)', fontWeight: 700 }}>Empty Set</span>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {collaborators.map(renderUserCard)}
          </div>
        )}
      </div>

      {/* 2. PERSONAL NETWORK SECTION */}
      {personalNetwork.length > 0 && (
        <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Sparkles size={16} color="var(--brand)" />
            <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Personal Network</h3>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {personalNetwork.map(renderUserCard)}
          </div>
        </div>
      )}

      {/* 3. SUGGESTED SECTION */}
      <div style={{ background: 'var(--surface)', borderRadius: '20px', border: '1px solid var(--border)', padding: '1rem', boxShadow: 'var(--shadow-sm)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
          <UserPlus size={16} color="var(--text-sub)" />
          <h3 style={{ margin: 0, fontSize: '0.75rem', fontWeight: 900, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Global Discovery</h3>
        </div>

        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
            {[1, 2, 3].map(i => <div key={i} className="skeleton" style={{ height: '32px', borderRadius: '6px' }} />)}
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {suggested.map(renderUserCard)}
          </div>
        )}
      </div>

      <style jsx>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(5px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>
    </div>
  )
}
