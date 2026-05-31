'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Target, Calendar, Trophy, Wallet } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const TABS = [
  { href: '/dashboard', label: '首頁',  Icon: Home     },
  { href: '/goals',     label: '目標',  Icon: Target   },
  { href: '/calendar',  label: '月曆',  Icon: Calendar },
  { href: '/rewards',   label: '獎勵',  Icon: Trophy   },
  { href: '/wallet',    label: '錢包',  Icon: Wallet   },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50">
      <div className="dark-panel mx-2 mb-2 rounded-2xl flex items-center justify-around px-1 py-1">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              className="relative flex flex-col items-center justify-center gap-0.5 flex-1 py-2 rounded-xl transition-colors"
            >
              {isActive && (
                <motion.div
                  layoutId="nav-pill"
                  className="absolute inset-0 rounded-xl"
                  style={{ background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)' }}
                  transition={{ type: 'spring', stiffness: 400, damping: 35 }}
                />
              )}
              <Icon
                size={20}
                className={`relative z-10 transition-colors ${
                  isActive ? 'text-green-400' : 'text-green-800/60'
                }`}
                strokeWidth={isActive ? 2.2 : 1.8}
              />
              <span
                className={`relative z-10 text-[10px] font-medium transition-colors ${
                  isActive ? 'text-green-400' : 'text-green-800/50'
                }`}
              >
                {label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
