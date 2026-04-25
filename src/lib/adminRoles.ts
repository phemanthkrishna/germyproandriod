import type { AdminRole } from '../types'

// Pages each role can access
// admin      → everything
// manager    → operations (no finance pages, no accounts)
// accountant → finance only

export const ROLE_ACCESS: Record<AdminRole, string[]> = {
  admin: [
    '/admin',
    '/admin/workers',
    '/admin/payments',
    '/admin/materials',
    '/admin/stores',
    '/admin/cities',
    '/admin/services',
    '/admin/ac-packages',
    '/admin/analytics',
    '/admin/promos',
    '/admin/campaigns',
    '/admin/accounts',
  ],
  manager: [
    '/admin',
    '/admin/workers',
    '/admin/materials',
    '/admin/stores',
    '/admin/cities',
    '/admin/services',
    '/admin/ac-packages',
    '/admin/promos',
    '/admin/campaigns',
  ],
  accountant: [
    '/admin/payments',
    '/admin/materials',
    '/admin/analytics',
  ],
}

export function canAccess(role: AdminRole | undefined, path: string): boolean {
  if (!role) return false
  const allowed = ROLE_ACCESS[role] ?? []
  // Match exact or prefix (for /admin/orders/:id etc)
  return allowed.some(p => path === p || path.startsWith(p + '/'))
}

export function defaultRoute(role: AdminRole | undefined): string {
  if (role === 'accountant') return '/admin/payments'
  return '/admin'
}

export const ROLE_LABELS: Record<AdminRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  accountant: 'Accountant',
}

export const ROLE_DESCRIPTIONS: Record<AdminRole, string> = {
  admin: 'Full access — orders, finance, workers, settings, account management',
  manager: 'Operations — orders, workers, stores, cities, services, promos, campaigns',
  accountant: 'Finance only — payments, materials, analytics',
}

export const ROLE_COLORS: Record<AdminRole, string> = {
  admin: 'bg-red-500/20 text-red-400 border-red-500/30',
  manager: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  accountant: 'bg-green-500/20 text-green-400 border-green-500/30',
}
