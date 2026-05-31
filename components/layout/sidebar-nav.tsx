'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useApp } from '@/lib/store'
import { useWalletConnection } from '@mysten/dapp-kit-react'
import { AddTransactionModal } from '@/components/shared/add-transaction-modal'
import {
  LayoutDashboard, ArrowLeftRight, Plus, LogOut,
  Coins, Wallet, ExternalLink, Star, Flame, CheckCircle,
} from 'lucide-react'
import { getDAppKit } from '@/lib/sui-dapp-kit'

const NAV = [
  { href: '/dashboard',    label: '儀表板', Icon: LayoutDashboard },
  { href: '/transactions', label: '交易紀錄', Icon: ArrowLeftRight  },
  { href: '/goals',        label: '財務目標', Icon: Star            },
  { href: '/rewards',      label: '任務',    Icon: Flame            },
]

const GOLD    = '#C8A45A'
const BORDER  = '#2C2920'
const MUTED   = '#6B6456'
const TEXT    = '#F0EDE6'
const INCOME  = '#52B788'
const EXPENSE = '#E07B5A'

// ── Wallet section ───────────────────────────────────────────
function WalletSection() {
  const kit = getDAppKit()
  const conn = useWalletConnection({ dAppKit: kit ?? undefined })

  if (!conn.isConnected && !conn.isConnecting) {
    return (
      <div style={{ padding: '0 14px 4px' }}>
        <p style={{ color: MUTED, fontSize: '9px', letterSpacing: '2px', fontWeight: 600, margin: '12px 6px 6px' }}>
          SUI 錢包
        </p>
        <button
          id="slush-connect-trigger"
          onClick={() => {
            const modal = document.querySelector('dapp-kit-connect-modal')
            if (modal) {
              // @ts-ignore
              modal.open = true
            } else {
              const wallets = kit?.stores.$wallets.get() ?? []
              const slush = wallets.find(w =>
                w.name.toLowerCase().includes('slush') || w.name.toLowerCase().includes('sui')
              )
              if (slush && kit) {
                kit.connectWallet({ wallet: slush }).catch(console.warn)
              }
            }
          }}
          style={{
            width: '100%', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer',
            border: '1px solid rgba(82,183,136,0.35)',
            background: 'rgba(82,183,136,0.06)',
            color: INCOME, fontSize: '11px', fontWeight: 600,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
          }}
        >
          <Wallet size={12} />
          連接 SLUSH 錢包
        </button>
        <WalletList kit={kit} />
      </div>
    )
  }

  if (conn.isConnecting) {
    return (
      <div style={{ padding: '0 20px 8px' }}>
        <p style={{ color: MUTED, fontSize: '11px', marginTop: '12px' }}>連接中...</p>
      </div>
    )
  }

  const addr  = conn.account?.address ?? ''
  const short = addr ? `${addr.slice(0, 8)}...${addr.slice(-6)}` : ''

  return (
    <div style={{ padding: '0 14px 4px' }}>
      <p style={{ color: MUTED, fontSize: '9px', letterSpacing: '2px', fontWeight: 600, margin: '12px 6px 6px' }}>
        SUI 錢包
      </p>
      <div style={{
        padding: '10px 12px', borderRadius: '6px',
        background: 'rgba(82,183,136,0.06)',
        border: '1px solid rgba(82,183,136,0.2)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '50%', background: INCOME, boxShadow: `0 0 6px ${INCOME}80` }} />
            <span style={{ color: INCOME, fontSize: '10px', fontWeight: 600 }}>已連接</span>
          </div>
          <button
            onClick={() => kit?.disconnectWallet()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, fontSize: '10px' }}
            onMouseEnter={e => (e.currentTarget.style.color = EXPENSE)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            中斷
          </button>
        </div>
        <p style={{ color: TEXT, fontSize: '11px', fontFamily: 'monospace', wordBreak: 'break-all' }}>{short}</p>
        {conn.wallet?.name && (
          <p style={{ color: MUTED, fontSize: '9px', marginTop: '3px' }}>{conn.wallet.name}</p>
        )}
        <a
          href={`https://suiscan.xyz/testnet/account/${addr}`}
          target="_blank" rel="noopener noreferrer"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '3px', color: GOLD, fontSize: '9px', marginTop: '5px', textDecoration: 'none' }}
        >
          <ExternalLink size={9} />
          在 SuiScan 查看
        </a>
      </div>
    </div>
  )
}

function WalletList({ kit }: { kit: ReturnType<typeof getDAppKit> }) {
  const [wallets, setWallets] = useState<{ name: string; icon?: string }[]>([])

  useEffect(() => {
    if (!kit) return
    const update = () => setWallets(kit.stores.$wallets.get().map(w => ({ name: w.name, icon: w.icon })))
    update()
    return kit.stores.$wallets.listen(update)
  }, [kit])

  if (wallets.length === 0) return (
    <p style={{ color: MUTED, fontSize: '10px', marginTop: '8px', padding: '0 6px' }}>
      未偵測到已安裝的錢包
    </p>
  )

  return (
    <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '3px' }}>
      {wallets.map(w => (
        <button
          key={w.name}
          onClick={() => {
            const uiWallet = kit?.stores.$wallets.get().find(x => x.name === w.name)
            if (uiWallet && kit) kit.connectWallet({ wallet: uiWallet }).catch(console.warn)
          }}
          style={{
            display: 'flex', alignItems: 'center', gap: '8px',
            padding: '7px 10px', borderRadius: '5px', border: 'none', cursor: 'pointer',
            background: 'rgba(255,255,255,0.03)', color: TEXT, fontSize: '11px', textAlign: 'left',
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(200,164,90,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.03)')}
        >
          {w.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={w.icon} alt={w.name} style={{ width: '16px', height: '16px', borderRadius: '3px' }} />
          )}
          {w.name}
        </button>
      ))}
    </div>
  )
}

// ── Main sidebar ─────────────────────────────────────────────
export function SidebarNav() {
  const pathname = usePathname()
  const router   = useRouter()
  const { state, dispatch, actions } = useApp()
  const [modal, setModal]     = useState(false)
  const [mounted, setMounted] = useState(false)
  const [checkinToast, setCheckinToast] = useState<string | null>(null)

  useEffect(() => { setMounted(true) }, [])

  function handleLogout() {
    dispatch({ type: 'HYDRATE', payload: { isOnboarded: false } })
    try { localStorage.removeItem('gf_app_state') } catch {}
    router.replace('/')
  }

  async function handleCheckIn() {
    if (state.rewards.hasCheckedInToday) return
    try {
      const result = await actions.checkIn()
      setCheckinToast(`✓ 連續 ${result.newStreak} 天！`)
      setTimeout(() => setCheckinToast(null), 2500)
    } catch {
      setCheckinToast('今日已簽到')
      setTimeout(() => setCheckinToast(null), 2000)
    }
  }

  function handleSubscribe() {
    if (!state.profile.isSubscribed) actions.subscribe()
  }

  const alreadyCheckedIn = state.rewards.hasCheckedInToday
  const isSubscribed     = state.profile.isSubscribed

  return (
    <>
      <aside style={{
        width: '224px', minHeight: '100vh',
        background: 'var(--bg-sidebar)',
        borderRight: `1px solid ${BORDER}`,
        display: 'flex', flexDirection: 'column',
        position: 'sticky', top: 0, height: '100vh',
        flexShrink: 0, overflowY: 'auto',
      }}>
        {/* Gold accent bar */}
        <div style={{ height: '2px', background: 'linear-gradient(90deg, var(--gold), transparent 70%)', flexShrink: 0 }} />

        {/* Logo */}
        <div style={{ padding: '16px 20px 12px', borderBottom: `1px solid ${BORDER}` }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '6px', flexShrink: 0,
              background: 'linear-gradient(135deg, #C8A45A 0%, #8B6914 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 2px 12px rgba(200,164,90,0.25)',
            }}>
              <Coins size={18} color="#fff" />
            </div>
            <div>
              <p style={{ color: TEXT, fontSize: '13px', fontWeight: 700 }}>流金理財</p>
              <p style={{ color: MUTED, fontSize: '9px', letterSpacing: '2px', marginTop: '1px' }}>財務管理</p>
            </div>
          </div>

          {/* ── 每日簽到 + 訂閱（左上角快捷） ── */}
          <div style={{ display: 'flex', gap: '6px', marginTop: '10px' }}>
            {/* 每日簽到 */}
            <button
              onClick={handleCheckIn}
              title={alreadyCheckedIn ? '今日已簽到' : '每日簽到'}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: '5px', cursor: alreadyCheckedIn ? 'default' : 'pointer',
                border: alreadyCheckedIn ? '1px solid rgba(82,183,136,0.25)' : '1px solid rgba(82,183,136,0.4)',
                background: alreadyCheckedIn ? 'rgba(82,183,136,0.04)' : 'rgba(82,183,136,0.10)',
                color: alreadyCheckedIn ? MUTED : INCOME,
                fontSize: '10px', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                transition: 'all 0.15s',
              }}
            >
              {alreadyCheckedIn
                ? <><CheckCircle size={11} /> 已簽到</>
                : <><Flame size={11} /> 簽到</>
              }
            </button>

            {/* 訂閱 */}
            <button
              onClick={handleSubscribe}
              title={isSubscribed ? '已訂閱' : '訂閱'}
              style={{
                flex: 1, padding: '6px 8px', borderRadius: '5px',
                cursor: isSubscribed ? 'default' : 'pointer',
                border: isSubscribed ? '1px solid rgba(200,164,90,0.25)' : '1px solid rgba(200,164,90,0.4)',
                background: isSubscribed ? 'rgba(200,164,90,0.04)' : 'rgba(200,164,90,0.10)',
                color: isSubscribed ? MUTED : GOLD,
                fontSize: '10px', fontWeight: 600,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px',
                transition: 'all 0.15s',
              }}
            >
              <Star size={11} fill={isSubscribed ? MUTED : 'none'} />
              {isSubscribed ? '已訂閱' : '訂閱'}
            </button>
          </div>

          {/* Checkin toast */}
          {checkinToast && (
            <div style={{
              marginTop: '6px', padding: '5px 10px', borderRadius: '4px',
              background: 'rgba(82,183,136,0.12)', border: '1px solid rgba(82,183,136,0.25)',
              color: INCOME, fontSize: '11px', fontWeight: 500, textAlign: 'center',
              animation: 'fadeUp 0.2s ease',
            }}>
              {checkinToast}
            </div>
          )}
        </div>

        {/* New Transaction */}
        <div style={{ padding: '12px 14px 6px' }}>
          <button
            onClick={() => setModal(true)}
            style={{
              width: '100%', padding: '9px 12px', borderRadius: '6px', cursor: 'pointer',
              border: '1px solid rgba(200,164,90,0.35)',
              background: 'rgba(200,164,90,0.06)',
              color: GOLD, fontSize: '12px', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              transition: 'background 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(200,164,90,0.12)'; e.currentTarget.style.borderColor = 'rgba(200,164,90,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(200,164,90,0.06)'; e.currentTarget.style.borderColor = 'rgba(200,164,90,0.35)' }}
          >
            <Plus size={13} />
            新增交易
          </button>
        </div>

        {/* Nav label */}
        <p style={{ padding: '14px 20px 4px', color: MUTED, fontSize: '9px', letterSpacing: '2px', fontWeight: 600 }}>
          功能選單
        </p>

        {/* Nav links */}
        <nav style={{ padding: '0 10px', flex: 1 }}>
          {NAV.map(({ href, label, Icon }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link key={href} href={href} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '9px 12px', borderRadius: '5px', marginBottom: '2px',
                textDecoration: 'none',
                background: active ? 'rgba(200,164,90,0.08)' : 'transparent',
                color: active ? GOLD : MUTED,
                fontSize: '13px', fontWeight: active ? 600 : 400,
                borderLeft: active ? `2px solid ${GOLD}` : '2px solid transparent',
                transition: 'all 0.15s',
              }}>
                <Icon size={15} strokeWidth={active ? 2 : 1.5} />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Wallet section */}
        {mounted && <WalletSection />}

        {/* Divider */}
        <div style={{ margin: '8px 14px 0', borderTop: `1px solid ${BORDER}` }} />

        {/* User + Logout */}
        <div style={{ padding: '14px 16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{
                width: '28px', height: '28px', borderRadius: '50%',
                border: '1px solid rgba(200,164,90,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'rgba(200,164,90,0.06)',
              }}>
                <span style={{ color: GOLD, fontSize: '11px', fontWeight: 700 }}>U</span>
              </div>
              <span style={{ color: TEXT, fontSize: '12px', fontWeight: 500 }}>使用者</span>
            </div>
            <button
              onClick={handleLogout}
              title="登出"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: MUTED, display: 'flex', transition: 'color 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.color = EXPENSE)}
              onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </aside>

      <AddTransactionModal open={modal} onClose={() => setModal(false)} />
    </>
  )
}
