import { createContext, useContext, useState, useEffect, ReactNode } from 'react'
import { supabase } from '../lib/supabase'

interface City { id: string; city_name: string; is_active: boolean }

interface CityContextValue {
  cities: City[]
  selectedCity: string | null   // null = all cities
  setSelectedCity: (city: string | null) => void
}

const CityContext = createContext<CityContextValue>({
  cities: [],
  selectedCity: null,
  setSelectedCity: () => {},
})

export function CityProvider({ children }: { children: ReactNode }) {
  const [cities, setCities] = useState<City[]>([])
  const [selectedCity, setSelectedCity] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('service_cities')
      .select('id, city_name, is_active')
      .eq('is_active', true)
      .order('city_name')
      .then(({ data }) => setCities(data || []))
  }, [])

  return (
    <CityContext.Provider value={{ cities, selectedCity, setSelectedCity }}>
      {children}
    </CityContext.Provider>
  )
}

export function useCity() {
  return useContext(CityContext)
}
