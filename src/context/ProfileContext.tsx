'use client'

import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { PersistentCache } from '@/utils/cache'
import { Profile } from '@/types/auth'

type ProfileContextType = {
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
  setProfile: React.Dispatch<React.SetStateAction<Profile | null>>
}

export const ProfileContext = createContext<ProfileContextType | undefined>(undefined)

export function ProfileProvider({ 
  children, 
  userId,
  initialProfile 
}: { 
  children: ReactNode
  userId: string
  initialProfile: Profile | null
}) {
  const [profile, setProfile] = useState<Profile | null>(() => {
    if (initialProfile) return initialProfile
    return PersistentCache.get<Profile>(`profile_${userId}`)
  })
  const [loading, setLoading] = useState(!initialProfile && !profile)
  const supabase = createBrowserSupabaseClient()

  const refreshProfile = useCallback(async () => {
    const { data } = await supabase
      .from('profiles')
      .select('*, groups(*)')
      .eq('id', userId)
      .single()
    if (data) {
      setProfile(data)
      PersistentCache.set(`profile_${userId}`, data, 3600000) // 1 Hour TTL
    }
  }, [supabase, userId])

  useEffect(() => {
    if (!userId) return

    let isMounted = true

    const initializeProfile = async () => {
      // Ensure we have current data if initial was partial or missing (crucially check for 'id')
      if (!profile || !profile.id) {
        await refreshProfile()
      }
      if (isMounted) {
        setLoading(false)
      }
    }

    initializeProfile()

    // Subscribe to REALTIME changes for the current user profile
    const channel = supabase
      .channel(`profile_sync_${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'profiles',
          filter: `id=eq.${userId}`
        },
        () => {
          // Instead of raw overprinting, trigger a full joined refetch
          if (isMounted) {
            refreshProfile()
          }
        }
      )
      .subscribe()

    return () => {
      isMounted = false
      supabase.removeChannel(channel)
    }
  }, [userId, profile, refreshProfile, supabase])

  return (
    <ProfileContext.Provider value={{ profile, loading, refreshProfile, setProfile }}>
      {children}
    </ProfileContext.Provider>
  )
}

export function useProfile() {
  const context = useContext(ProfileContext)
  if (context === undefined) {
    throw new Error('useProfile must be used within a ProfileProvider')
  }
  return context
}
