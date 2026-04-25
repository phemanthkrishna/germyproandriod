import { ClipboardList, Users, DollarSign, Package, Store, MapPin, Wrench, BarChart2, Tag, Bell, ShieldCheck, Snowflake } from 'lucide-react'
import type { AdminRole } from '../types'

export const ADMIN_NAV = [
  { to: '/admin',              icon: ClipboardList, label: 'Orders',      section: 'ops'     },
  { to: '/admin/workers',      icon: Users,         label: 'Workers',     section: 'ops'     },
  { to: '/admin/materials',    icon: Package,       label: 'Materials',   section: 'ops'     },
  { to: '/admin/stores',       icon: Store,         label: 'Stores',      section: 'ops'     },
  { to: '/admin/cities',       icon: MapPin,        label: 'Cities',      section: 'ops'     },
  { to: '/admin/services',     icon: Wrench,        label: 'Services',    section: 'ops'     },
  { to: '/admin/ac-packages',  icon: Snowflake,     label: 'AC Packages', section: 'ops'     },
  { to: '/admin/promos',       icon: Tag,           label: 'Promos',      section: 'ops'     },
  { to: '/admin/campaigns',    icon: Bell,          label: 'Campaigns',   section: 'ops'     },
  { to: '/admin/payments',     icon: DollarSign,    label: 'Payments',    section: 'finance' },
  { to: '/admin/analytics',    icon: BarChart2,     label: 'Analytics',   section: 'finance' },
  { to: '/admin/accounts',     icon: ShieldCheck,   label: 'Accounts',    section: 'admin'   },
]

// Which nav items each role can see
export const NAV_ROLE_ACCESS: Record<AdminRole, string[]> = {
  admin: ADMIN_NAV.map(n => n.to),
  manager: [
    '/admin', '/admin/workers', '/admin/materials', '/admin/stores',
    '/admin/cities', '/admin/services', '/admin/ac-packages', '/admin/promos', '/admin/campaigns',
  ],
  accountant: ['/admin/payments', '/admin/materials', '/admin/analytics'],
}
