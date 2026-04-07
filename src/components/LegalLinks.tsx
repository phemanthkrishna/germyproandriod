import { useNavigate } from 'react-router-dom'

const LINKS = [
  { label: 'About Us',          to: '/legal/about'          },
  { label: 'Privacy Policy',    to: '/legal/privacy-policy' },
  { label: 'Terms & Conditions', to: '/legal/terms'         },
  { label: 'Refund Policy',     to: '/legal/refund-policy'  },
]

export function LegalLinks() {
  const navigate = useNavigate()

  return (
    <div className="mt-6 mb-2 border-t border-[var(--border)] pt-5">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {LINKS.map(({ label, to }) => (
          <button
            key={label}
            onClick={() => navigate(to)}
            className="text-xs text-[var(--muted)] hover:text-[var(--text)] transition-colors"
          >
            {label}
          </button>
        ))}
      </div>
      <p className="text-center text-[10px] text-[var(--muted)] mt-3 opacity-60">
        © {new Date().getFullYear()} GetMyPro. All rights reserved.
      </p>
    </div>
  )
}
