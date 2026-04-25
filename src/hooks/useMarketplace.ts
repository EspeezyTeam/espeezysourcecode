'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createBrowserSupabaseClient } from '@/utils/supabase/client'
import { useSmartLoading } from '@/components/GlobalLoadingProvider'
import { useNotifications } from '@/components/NotificationProvider'
import { Listing, MarketplaceCategory } from '@/types/marketplace'

export function useMarketplace() {
  const [listings, setListings] = useState<Listing[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeCategory, setActiveCategory] = useState<MarketplaceCategory>('All')
  const [isPosting, setIsPosting] = useState(false)
  const [showWalkthrough, setShowWalkthrough] = useState(false)
  const [selectedListing, setSelectedListing] = useState<Listing | null>(null)
  
  const supabase = useMemo(() => createBrowserSupabaseClient(), [])
  const { withLoading } = useSmartLoading()
  const { addToast } = useNotifications()

  const fetchListings = useCallback(async () => {
    setLoading(true)
    
    const { data: listingsData, error: listingsError } = await supabase
      .from('marketplace_listings')
      .select('*')
      .order('created_at', { ascending: false })
    
    if (listingsError) {
      console.error('Fetch error:', listingsError.message)
      setListings([])
      setLoading(false)
      return
    }

    const ownerIds = Array.from(new Set(listingsData?.map(l => l.owner_id) || []))
    
    if (ownerIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url, role')
        .in('id', ownerIds)

      if (profilesError) {
        console.error('Profiles fetch error:', profilesError.message)
      }

      const profileMap = (profilesData || []).reduce((acc, p) => {
        acc[p.id] = p
        return acc
      }, {} as Record<string, any>)

      const merged = listingsData.map(l => ({
        ...l,
        profiles: profileMap[l.owner_id]
      }))

      setListings(merged)
      localStorage.setItem('gf_marketplace_cache', JSON.stringify(merged))
    } else {
      setListings([])
      localStorage.setItem('gf_marketplace_cache', JSON.stringify([]))
    }
    
    setLoading(false)
  }, [supabase])

  useEffect(() => {
    const hasSeen = localStorage.getItem('gf_marketplace_onboarding')
    if (!hasSeen) {
      setShowWalkthrough(true)
      localStorage.setItem('gf_marketplace_onboarding', 'true')
    }

    const cached = localStorage.getItem('gf_marketplace_cache')
    if (cached) {
      try {
        setListings(JSON.parse(cached))
        setLoading(false)
      } catch (e) {
        console.error("Marketplace cache corrupted", e)
      }
    }

    void fetchListings()
  }, [fetchListings])

  const filteredListings = useMemo(() => {
    const query = searchQuery.toLowerCase()
    return listings.filter(l => {
      const matchesSearch = l.title.toLowerCase().includes(query) ||
                          l.description?.toLowerCase().includes(query)
      const matchesCategory = activeCategory === 'All' || l.category === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [listings, searchQuery, activeCategory])

  return {
    listings,
    filteredListings,
    loading,
    searchQuery,
    setSearchQuery,
    activeCategory,
    setActiveCategory,
    isPosting,
    setIsPosting,
    showWalkthrough,
    setShowWalkthrough,
    selectedListing,
    setSelectedListing,
    fetchListings,
    supabase
  }
}
