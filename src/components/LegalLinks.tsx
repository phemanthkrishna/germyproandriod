const LINKS = [
  { label: 'About Us',        href: 'https://www.getmypro.in/#about'          },
  { label: 'Privacy Policy',  href: 'https://www.getmypro.in/#privacy-policy' },
  { label: 'Terms & Conditions', href: 'https://www.getmypro.in/#terms'       },
  { label: 'Refund Policy',   href: 'https://www.getmypro.in/#refund-policy'  },
]

function openLink(href: string) {
  // On Capacitor native, _system opens in device browser; on web, _blank works fine
  const target = (window as any)?.Capacitor?.isNativePlatform?.() ? '_system' : '_blank'
  window.open(href, target, 'noopener,noreferrer')
}

export function LegalLinks() {
  return (
    <div className="mt-6 mb-2 border-t border-[var(--border)] pt-5">
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-2">
        {LINKS.map(({ label, href }) => (
          <button
            key={label}
            onClick={() => openLink(href)}
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
