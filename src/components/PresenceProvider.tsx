'use client'

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo, useRef, useTransition } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { PresenceContextType, PresenceState } from '@/types/ui'
import { useNotifications } from '@/components/NotificationProvider'
import { useProfile } from '@/context/ProfileContext'
import { hasFeature } from '@/utils/feature-gate'

const PresenceContext = createContext<PresenceContextType>({
  onlineUsers: new Set(),
  typingUsers: new Set(),
  setTypingStatus: async () => {}
})

export const usePresence = () => useContext(PresenceContext)

type PresenceProviderProps = {
  user?: { id: string; full_name?: string }
  children: React.ReactNode
}

export const PresenceProvider = ({ user, children }: PresenceProviderProps) => {
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set())
  const [typingUsers, setTypingUsers] = useState<Set<string>>(new Set())
  const [, startTransition] = useTransition()
  const [channel, setChannel] = useState<RealtimeChannel | null>(null)
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { addToast } = useNotifications()
  const { profile } = useProfile()
  
  const userId = user?.id
  const userName = user?.full_name
  const groupId = profile?.group_id

  // Anti-spam notification cache: maps userId to timestamp
  const lastNotified = useRef<Map<string, number>>(new Map())
  // Throttle ref: lives outside useEffect so it persists across the effect's closure
  const syncThrottle = useRef<NodeJS.Timeout | null>(null)

  const setTypingStatus = useCallback(async (isTyping: boolean) => {
    if (!channel || !userId) return

    await channel.track({
      user_id: userId,
      full_name: userName,
      group_id: groupId,
      online_at: new Date().toISOString(),
      is_typing: isTyping
    })
  }, [channel, userId, userName, groupId])

  useEffect(() => {
    if (!userId) return

    const newChannel = supabase.channel('global_presence', {
      config: {
        presence: {
          key: userId
        }
      }
    })

    const processSync = () => {
      const state = newChannel.presenceState() as PresenceState
      const onlineIds = new Set<string>()
      const typingIds = new Set<string>()

      Object.entries(state).forEach(([key, presenceItems]) => {
        onlineIds.add(key)
        if (presenceItems[0]?.is_typing) {
          typingIds.add(key)
        }
      })

      startTransition(() => {
        setOnlineUsers(onlineIds)
        setTypingUsers(typingIds)
      })
      syncThrottle.current = null
    }

    newChannel
      .on('presence', { event: 'sync' }, () => {
        if (syncThrottle.current) return
        syncThrottle.current = setTimeout(processSync, 750)
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        startTransition(() => {
          setOnlineUsers((prev) => new Set(prev).add(key))
          if (newPresences[0]?.is_typing) {
            setTypingUsers((prev) => new Set(prev).add(key))
          }
        })

        const newcomerGroupId = newPresences[0]?.group_id
        const name = newPresences[0]?.full_name || 'A teammate'
        
        // Scope Check: Only notify for teammates in the same group
        if (key !== userId && newcomerGroupId === groupId && groupId) {
          const now = Date.now()
          const lastTime = lastNotified.current.get(key) || 0
          
          // Interval check: Skip if we notified about this user recently (< 1 minute) to prevent flapping loops
          if (now - lastTime > 60000) {
            addToast('Teammate Online', `${name} is online now`, 'success')
            lastNotified.current.set(key, now)
          }
        }
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        startTransition(() => {
          setOnlineUsers((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
          setTypingUsers((prev) => {
            const next = new Set(prev)
            next.delete(key)
            return next
          })
        })

        const leaverGroupId = leftPresences[0]?.group_id
        const name = leftPresences[0]?.full_name || 'A teammate'
        
        // Scope Check: Only notify for teammates in the same group
        if (key !== userId && leaverGroupId === groupId && groupId) {
          const now = Date.now()
          const lastTime = lastNotified.current.get(key) || 0

          // Interval check: Skip if we notified about this user recently
          if (now - lastTime > 60000) {
            addToast('Teammate Offline', `${name} is offline now`, 'info')
            lastNotified.current.set(key, now)
          }
        }
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          setChannel(newChannel)
          await newChannel.track({
            user_id: userId,
            full_name: userName,
            group_id: groupId,
            online_at: new Date().toISOString(),
            is_typing: false,
            music: hasFeature(profile, 'JUKEBOX') ? (window as any)._spotify_presence : undefined
          })

          await supabase
            .from('profiles')
            .update({ last_seen: new Date().toISOString() })
            .eq('id', userId)
        }
      })

    // 1-minute heartbeat for reliable 'last_seen' persistence (WhatsApp style)
    const updateLastSeen = async () => {
      if (!userId) return
      await supabase
        .from('profiles')
        .update({ last_seen: new Date().toISOString() })
        .eq('id', userId)
    }

    const heartbeat = setInterval(updateLastSeen, 1000 * 60)

    // Capture tab closures or visibility changes for immediate DB update
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        void updateLastSeen()
      }
    }

    window.addEventListener('visibilitychange', handleVisibilityChange)
    window.addEventListener('beforeunload', updateLastSeen)

    return () => {
      clearInterval(heartbeat)
      window.removeEventListener('visibilitychange', handleVisibilityChange)
      window.removeEventListener('beforeunload', updateLastSeen)
      supabase.removeChannel(newChannel)
    }
  }, [userId, userName, groupId, supabase, addToast])

  return (
    <PresenceContext.Provider value={{ onlineUsers, typingUsers, setTypingStatus }}>
      {children}
    </PresenceContext.Provider>
  )
}
