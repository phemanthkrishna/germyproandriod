import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

let cache: Set<string> | null = null

export function useActiveServices() {
  const [activeServices, setActiveServices] = useState<Set<string>>(cache ?? new Set())
  const [loading, setLoading] = useState(cache === null)

  useEffect(() => {
    if (cache !== null) { setActiveServices(cache); setLoading(false); return }

    supabase
      .from('active_services')
      .select('service_name')
      .eq('is_active', true)
      .then(({ data }) => {
        const set = new Set((data || []).map(r => r.service_name))
        cache = set
        setActiveServices(set)
        setLoading(false)
      })
  }, [])

  function invalidate() { cache = null }

  return { activeServices, loading, invalidate }
}
