'use client'

/**
 * useAdminDashboard
 *
 * Custom hook that owns ALL state and data-fetching for the Admin Dashboard.
 * No UI code lives here — just data, effects, and callbacks.
 *
 * Why a hook?
 *   - Keeps page.tsx and every sub-component free of business logic.
 *   - Makes every action testable in isolation.
 *   - A single place to change the data layer later (e.g. swap direct Supabase
 *     calls for API service calls) without touching any component.
 */

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { useProfile } from '@/context/ProfileContext'
import { useNotifications } from '@/components/NotificationProvider'
import type {
  AdminStats,
  RecentUser,
  SystemLog,
  LaunchConfig,
  PlatformConfig,
} from './types'

// ── Default values defined outside the hook ────────────────────────────────────
// Keeps them stable across renders (no new object reference each call).

const DEFAULT_STATS: AdminStats = { users: 0, pro: 0, premium: 0, revenue: 0 }

const DEFAULT_LAUNCH_CONFIG: LaunchConfig = {
  launch_date: '',
  launch_message: '',
  preregister_goal: '',
  preregister_open: 'true',
  brand_name: '',
  platform_version: '',
}

const SEED_LOGS: SystemLog[] = [
  { t: '13:42:01', m: 'AUTH_GATEWAY: [200] OK' },
  { t: '13:42:05', m: 'SUPABASE_SYNC: Institutional Node Established' },
  { t: '13:42:12', m: 'STRIPE_WEBHOOK: Listening on events' },
  { t: '13:42:18', m: 'ELITE30_CHECK: 4 redemptions validated' },
]

// ── Hook ───────────────────────────────────────────────────────────────────────

export function useAdminDashboard() {
  const { profile, loading: profileLoading } = useProfile()
  const router = useRouter()
  const supabase = createBrowserSupabaseClient()
  const { addToast } = useNotifications()

  // ── Auth / verification state ──
  const [isVerified, setIsVerified] = useState(false)
  const [verificationCode, setVerificationCode] = useState('')
  const [verifying, setVerifying] = useState(false)

  // ── Dashboard data ──
  const [stats, setStats] = useState<AdminStats>(DEFAULT_STATS)
  const [recentUsers, setRecentUsers] = useState<RecentUser[]>([])
  const [loading, setLoading] = useState(true)
  const [systemLogs, setSystemLogs] = useState<SystemLog[]>([])
  const [config, setConfig] = useState<PlatformConfig>({})
  const [savingConfig, setSavingConfig] = useState(false)

  // ── Launch config ──
  const [launchConfig, setLaunchConfig] = useState<LaunchConfig>(DEFAULT_LAUNCH_CONFIG)
  const [preregCount, setPreregCount] = useState(0)
  const [savingLaunchConfig, setSavingLaunchConfig] = useState(false)

  // ── Effect: redirect non-admins ────────────────────────────────────────────
  useEffect(() => {
    if (profileLoading) return
    if (!profile || profile.role !== 'admin') {
      addToast(
        'Unauthorized Access',
        'You do not have administrative clearance for this terminal.',
        'error',
      )
      router.push('/dashboard')
    }
  }, [profile, profileLoading, router, addToast])

  // ── Effect: live terminal log heartbeat ────────────────────────────────────
  useEffect(() => {
    if (!isVerified) return

    // Show seed logs immediately on verification
    queueMicrotask(() => setSystemLogs(SEED_LOGS))

    const interval = setInterval(() => {
      const time = new Date().toLocaleTimeString('en-GB', { hour12: false })
      const nodeId = Math.floor(Math.random() * 100)
      setSystemLogs((prev) => [
        { t: time, m: `UPLINK_EVENT: Heartbeat detected from Node_${nodeId}` },
        ...prev.slice(0, 7), // keep the last 7 + the new one = 8 visible lines
      ])
    }, 5000)

    return () => clearInterval(interval)
  }, [isVerified])

  // ── fetchAdminData ─────────────────────────────────────────────────────────
  // All 5 queries run in parallel with Promise.all for performance.
  const fetchAdminData = useCallback(async () => {
    setLoading(true)

    const [
      { count: totalUsers },
      { count: proUsers },
      { count: premiumUsers },
      { count: lifetimeUsers },
      { data: recent },
      { data: platformConfig },
    ] = await Promise.all([
      supabase.from('profiles').select('*', { count: 'exact', head: true }),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_plan', 'pro'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_plan', 'premium'),
      supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('subscription_plan', 'lifetime'),
      supabase
        .from('profiles')
        .select('id, full_name, email, subscription_plan, created_at, role')
        .order('created_at', { ascending: false })
        .limit(8),
      supabase.from('platform_config').select('*'),
    ])

    // Convert the config rows array into a key-indexed map
    const configMap = (platformConfig ?? []).reduce<PlatformConfig>(
      (acc, item) => ({ ...acc, [item.key]: item }),
      {},
    )

    setStats({
      users: totalUsers ?? 0,
      pro: proUsers ?? 0,
      premium: (premiumUsers ?? 0) + (lifetimeUsers ?? 0),
      // Estimated revenue calculation
      revenue:
        (proUsers ?? 0) * 4.99 +
        (premiumUsers ?? 0) * 14.99 +
        (lifetimeUsers ?? 0) * 99,
    })
    setRecentUsers((recent as RecentUser[]) ?? [])
    setConfig(configMap)
    setLoading(false)
  }, [supabase])

  // ── Effect: fetch data + real-time subscriptions once verified ─────────────
  useEffect(() => {
    if (!isVerified) return

    queueMicrotask(() => void fetchAdminData())

    const channel = supabase
      .channel('admin_sync')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'platform_config' },
        () => {
          addToast('Platform Real-time Sync', 'Marketing configuration updated.', 'success')
          fetchAdminData()
        },
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'profiles' },
        () => {
          addToast(
            'Institutional Event',
            'User registration detected. Refreshing terminal...',
            'success',
          )
          fetchAdminData()
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [isVerified, supabase, addToast, fetchAdminData])

  // ── Effect: load launch config and pre-reg count ───────────────────────────
  useEffect(() => {
    if (!isVerified) return

    async function loadLaunchConfig() {
      try {
        const [cfgRes, countRes] = await Promise.all([
          fetch('/api/admin/launch-config'),
          fetch('/api/preregister'),
        ])
        const { config: cfg } = await cfgRes.json()
        const { count } = await countRes.json()
        if (cfg) setLaunchConfig((prev) => ({ ...prev, ...cfg }))
        setPreregCount(count ?? 0)
      } catch {
        // Non-critical — silently ignore; the form just shows empty defaults
      }
    }

    loadLaunchConfig()
  }, [isVerified])

  // ── Actions ────────────────────────────────────────────────────────────────

  /** Saves all launch config fields to the API and shows a toast. */
  const saveLaunchConfig = useCallback(async () => {
    setSavingLaunchConfig(true)
    try {
      const updates = Object.entries(launchConfig).map(([key, value]) => ({ key, value }))
      const res = await fetch('/api/admin/launch-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      })
      if (res.ok) {
        addToast('Launch Config Saved', 'Pre-registration page updated live.', 'success')
      } else {
        addToast('Save Failed', 'Could not update launch configuration.', 'error')
      }
    } catch {
      addToast('Network Error', 'Failed to save configuration.', 'error')
    }
    setSavingLaunchConfig(false)
  }, [launchConfig, addToast])

  /**
   * Performs a quick user action (ban / upgrade / unlock) from the user list.
   * Uses the Supabase client directly so the change is instant.
   */
  const handleUserAction = useCallback(
    async (userId: string, action: 'unlock' | 'upgrade' | 'ban') => {
      addToast(
        'Orchestration Command Sent',
        `Executing ${action} on node ${userId.slice(0, 8)}...`,
        'success',
      )

      const updateData =
        action === 'upgrade'
          ? { subscription_plan: 'premium' }
          : action === 'ban'
            ? { role: 'banned' }
            : { role: 'user' }

      const { error } = await supabase
        .from('profiles')
        .update(updateData)
        .eq('id', userId)

      if (error) {
        addToast('Command Failed', error.message, 'error')
      } else {
        addToast('Operation Success', 'Database synchronized.', 'success')
        fetchAdminData()
      }
    },
    [supabase, addToast, fetchAdminData],
  )

  /** Updates a single key in the platform_config table. */
  const updatePlatformConfig = useCallback(
    async (
      key: string,
      updates: Record<string, string | number | boolean | Record<string, string>>,
    ) => {
      setSavingConfig(true)
      const { error } = await supabase
        .from('platform_config')
        .update(updates)
        .eq('key', key)

      if (error) {
        addToast('Sync Error', error.message, 'error')
      } else {
        addToast('State Persisted', `${key} re-routed successfully.`, 'success')
        fetchAdminData()
      }
      setSavingConfig(false)
    },
    [supabase, addToast, fetchAdminData],
  )

  /**
   * Verifies the admin clearance code.
   * The code is intentionally simple — the real gate is the server-side
   * role check in the layout and every API route.
   */
  const handleVerify = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      setVerifying(true)
      setTimeout(() => {
        if (verificationCode === '2026-ADMIN') {
          setIsVerified(true)
          addToast('Identity Verified', 'Administrative session established.', 'success')
        } else {
          addToast(
            'Verification Failed',
            'Invalid clearance code. Retry limit approaching.',
            'error',
          )
        }
        setVerifying(false)
      }, 1200)
    },
    [verificationCode, addToast],
  )

  /** Navigates to the theme studio from the UI Orchestrator card. */
  const handleLaunchStudio = useCallback(() => {
    addToast('Orchestrator Initialized', 'Rerouting terminal to design studio...', 'success')
    router.push('/dashboard/settings?tab=themes')
  }, [addToast, router])

  // ── Return the full public API of this hook ────────────────────────────────
  return {
    // profile
    profile,
    profileLoading,

    // verification
    isVerified,
    verificationCode,
    setVerificationCode,
    verifying,
    handleVerify,

    // dashboard data
    stats,
    recentUsers,
    loading,
    systemLogs,
    config,
    setConfig,
    savingConfig,

    // launch config
    launchConfig,
    setLaunchConfig,
    preregCount,
    savingLaunchConfig,
    saveLaunchConfig,

    // actions
    fetchAdminData,
    handleUserAction,
    updatePlatformConfig,
    handleLaunchStudio,
  }
}
