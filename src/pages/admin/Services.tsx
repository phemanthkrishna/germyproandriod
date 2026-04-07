import { useState, useEffect } from 'react'
import { toast } from 'sonner'
import { supabase } from '../../lib/supabase'
import { BottomNav } from '../../components/BottomNav'
import { SERVICES } from '../../constants'
import { ClipboardList, Users, DollarSign, Package, Store, MapPin, Wrench, ToggleLeft, ToggleRight } from 'lucide-react'

const NAV = [
  { to: '/admin',           icon: ClipboardList, label: 'Orders'   },
  { to: '/admin/workers',   icon: Users,         label: 'Workers'  },
  { to: '/admin/payments',  icon: DollarSign,    label: 'Payments' },
  { to: '/admin/materials', icon: Package,       label: 'Materials'},
  { to: '/admin/stores',    icon: Store,         label: 'Stores'   },
  { to: '/admin/cities',    icon: MapPin,        label: 'Cities'   },
  { to: '/admin/services',  icon: Wrench,        label: 'Services' },
]

interface ServiceRow {
  id: string
  service_name: string
  is_active: boolean
}

export default function AdminServices() {
  const [rows, setRows] = useState<ServiceRow[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)

  useEffect(() => { fetch() }, [])

  async function fetch() {
    setLoading(true)
    const { data, error } = await supabase
      .from('active_services')
      .select('*')
      .order('service_name')
    if (error) toast.error('Failed to load services')
    // Sort to match SERVICES order
    const order = SERVICES.map(s => s.name)
    const sorted = (data || []).sort((a, b) => order.indexOf(a.service_name) - order.indexOf(b.service_name))
    setRows(sorted)
    setLoading(false)
  }

  async function toggle(row: ServiceRow) {
    setSaving(row.id)
    const { error } = await supabase
      .from('active_services')
      .update({ is_active: !row.is_active })
      .eq('id', row.id)
    if (error) {
      toast.error('Failed to update service')
    } else {
      toast.success(`${row.service_name} ${!row.is_active ? 'activated ✓' : 'deactivated'}`)
      setRows(prev => prev.map(r => r.id === row.id ? { ...r, is_active: !r.is_active } : r))
    }
    setSaving(null)
  }

  const activeCount = rows.filter(r => r.is_active).length

  return (
    <div className="page-content px-5 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-black font-heading text-slate-50">Services</h1>
        <p className="text-slate-400 text-sm mt-0.5">
          {activeCount} active · {rows.length} total
        </p>
      </div>

      {loading ? (
        <p className="text-slate-400 text-sm text-center py-8">Loading...</p>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(row => {
            const svc = SERVICES.find(s => s.name === row.service_name)
            return (
              <div
                key={row.id}
                className={`bg-[var(--surface)] border rounded-2xl p-4 flex items-center justify-between gap-3 transition-colors ${
                  row.is_active ? 'border-green-500/30 bg-green-500/5' : 'border-[var(--border)]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
                    row.is_active ? '' : 'grayscale opacity-50'
                  }`}>
                    {svc?.emoji ?? '🔧'}
                  </div>
                  <div>
                    <p className="text-slate-50 font-bold text-sm">{row.service_name}</p>
                    <p className="text-slate-500 text-xs">{svc?.desc}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                    row.is_active
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-slate-700 text-slate-400'
                  }`}>
                    {row.is_active ? 'Live' : 'Soon'}
                  </span>
                  <button
                    onClick={() => toggle(row)}
                    disabled={saving === row.id}
                    className="disabled:opacity-40 transition-colors"
                  >
                    {row.is_active
                      ? <ToggleRight size={28} className="text-green-400" />
                      : <ToggleLeft size={28} className="text-slate-500" />
                    }
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
        <p className="text-blue-400 text-xs font-bold mb-1">How it works</p>
        <p className="text-slate-400 text-xs leading-relaxed">
          Inactive services show as greyed out with a "Coming Soon" label in the customer app.
          Toggle a service ON to make it instantly bookable.
        </p>
      </div>

      <BottomNav items={NAV} />
    </div>
  )
}
