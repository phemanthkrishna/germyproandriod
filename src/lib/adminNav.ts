import { ClipboardList, Users, DollarSign, Package, Store, MapPin, Wrench, BarChart2, Tag, Bell } from 'lucide-react'

export const ADMIN_NAV = [
  { to: '/admin',             icon: ClipboardList, label: 'Orders'    },
  { to: '/admin/workers',     icon: Users,         label: 'Workers'   },
  { to: '/admin/payments',    icon: DollarSign,    label: 'Payments'  },
  { to: '/admin/materials',   icon: Package,       label: 'Materials' },
  { to: '/admin/stores',      icon: Store,         label: 'Stores'    },
  { to: '/admin/cities',      icon: MapPin,        label: 'Cities'    },
  { to: '/admin/services',    icon: Wrench,        label: 'Services'  },
  { to: '/admin/analytics',   icon: BarChart2,     label: 'Analytics' },
  { to: '/admin/promos',      icon: Tag,           label: 'Promos'    },
  { to: '/admin/campaigns',   icon: Bell,          label: 'Campaigns' },
]
