import { NavLink } from 'react-router-dom'
import { LucideIcon } from 'lucide-react'

interface NavItem {
  to: string
  icon: LucideIcon
  label: string
  activeColor?: string   // defaults to blue-500 (#3b82f6)
}

export function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[430px] bg-[var(--surface)] border-t border-[var(--border)] flex overflow-x-auto no-scrollbar z-50"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      {items.map(({ to, icon: Icon, label, activeColor }) => (
        <NavLink
          key={to}
          to={to}
          end
          className={({ isActive }) =>
            `flex-shrink-0 min-w-[64px] flex flex-col items-center justify-center py-3 gap-1 transition-colors ${
              isActive ? '' : 'text-slate-500'
            }`
          }
          style={({ isActive }) =>
            isActive ? { color: activeColor ?? '#3b82f6' } : undefined
          }
        >
          <Icon size={20} />
          <span className="text-xs font-semibold">{label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
