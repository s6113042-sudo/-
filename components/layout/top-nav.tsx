'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useApp } from '@/lib/store'
import { useRouter } from 'next/navigation'
import { AddTransactionModal } from '@/components/shared/add-transaction-modal'
import { Plus, LayoutDashboard, List, Globe, Sun, User, LogOut } from 'lucide-react'

const NAV_LINKS = [
  { href: '/dashboard',    label: 'Dashboard',    Icon: LayoutDashboard },
  { href: '/transactions', label: 'Transactions', Icon: List },
]

// Nav bar bg
const NAV_BG   = '#0e1929'
const NAV_BORDER = '1px solid #1e2d4a'

export function TopNav() {
  const pathname   = usePathname()
  const router     = useRouter()
  const { dispatch } = useApp()
  const [modalOpen, setModalOpen] = useState(false)

  function handleLogout() {
    dispatch({ type: 'HYDRATE', payload: { isOnboarded: false } })
    try { localStorage.removeItem('gf_app_state') } catch {}
    router.replace('/')
  }

  return (
    <>
      <nav style={{
        background: NAV_BG,
        borderBottom: NAV_BORDER,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        height: '56px',
        position: 'sticky',
        top: 0,
        zIndex: 40,
      }}>

        {/* ── Logo ─────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: '160px' }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '6px', flexShrink: 0,
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <span style={{ color: '#fff', fontSize: '12px', fontWeight: 700 }}>FG</span>
          </div>
          <span style={{ color: '#ffffff', fontWeight: 600, fontSize: '15px', whiteSpace: 'nowrap' }}>
            Flowing Gold
          </span>
        </div>

        {/* ── Nav links + Add button ────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          {NAV_LINKS.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                style={{
                  display: 'flex', alignItems: 'center', gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: 500,
                  textDecoration: 'none',
                  color: active ? '#ffffff' : '#64748b',
                  transition: 'color 0.15s',
                }}
              >
                <Icon size={15} />
                {label}
              </Link>
            )
          })}

          {/* + Add button */}
          <button
            onClick={() => setModalOpen(true)}
            style={{
              marginLeft: '12px',
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '7px 16px',
              borderRadius: '6px',
              background: '#3b82f6',
              border: 'none',
              color: '#ffffff',
              fontSize: '14px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Plus size={15} />
            Add
          </button>
        </div>

        {/* ── User area ─────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: '200px', justifyContent: 'flex-end' }}>
          {/* User badge */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: '26px', height: '26px', borderRadius: '50%',
              background: '#1e2d4a',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <User size={13} color="#64748b" />
            </div>
            <span style={{ color: '#94a3b8', fontSize: '14px' }}>User</span>
          </div>

          {/* Logout */}
          <button
            onClick={handleLogout}
            style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'none', border: 'none', color: '#ef4444', fontSize: '14px', fontWeight: 500, cursor: 'pointer' }}
          >
            <LogOut size={14} />
            Logout
          </button>

          {/* Language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#64748b', fontSize: '13px', cursor: 'default', userSelect: 'none' }}>
            <Globe size={14} />
            <span>English</span>
            <span style={{ fontSize: '10px' }}>▾</span>
          </div>

          {/* Theme toggle */}
          <button
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
            onMouseEnter={e => (e.currentTarget.style.color = '#e2e8f0')}
            onMouseLeave={e => (e.currentTarget.style.color = '#64748b')}
          >
            <Sun size={18} />
          </button>
        </div>
      </nav>

      <AddTransactionModal open={modalOpen} onClose={() => setModalOpen(false)} />
    </>
  )
}
