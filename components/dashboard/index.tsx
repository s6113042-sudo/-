'use client'

import { useState, useMemo, useEffect } from 'react'
import { useApp } from '@/lib/store'
import type { Goal, UserProfile } from '@/types'
import { TX_CATEGORIES } from '@/lib/constants'
import { useWalletConnection } from '@mysten/dapp-kit-react'
import { getDAppKit } from '@/lib/sui-dapp-kit'
import { fetchMonthOnChainData, type OnChainDayRecord } from '@/lib/sui-wallet-service'
import {
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip,
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
} from 'recharts'
import {
  ArrowUpRight, ArrowDownRight, Download,
  TrendingUp, ChevronDown,
} from 'lucide-react'
import {
  format, parseISO, startOfMonth, endOfMonth, startOfYear,
  subMonths, eachDayOfInterval, addMonths, getDay, getDaysInMonth,
} from 'date-fns'
import { txService, financeService } from '@/lib/api'

// ── Constants ────────────────────────────────────────────────
const GOLD       = '#C8A45A'
const GOLD_DIM   = 'rgba(200,164,90,0.15)'
const GOLD_BDR   = 'rgba(200,164,90,0.3)'
const TEXT       = '#F0EDE6'
const MUTED      = '#6B6456'
const INCOME_C   = '#52B788'
const EXPENSE_C  = '#E07B5A'
const CARD       = '#161612'
const BORDER     = '#2C2920'
const SERIF      = "Georgia, 'Times New Roman', serif"
const CARD_S: React.CSSProperties = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: '6px',
}
const GRID3: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '12px' }
const GRID2: React.CSSProperties = { display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '12px' }

const CAT_EN: Record<string, string> = {
  salary: '薪資', investment_income: '投資收益', bonus: '獎金',
  food: '餐飲', transport: '交通', entertainment: '娛樂',
  shopping: '購物', health: '醫療', utilities: '帳單',
  goal_deposit: '教育', impulse: '衝動消費', other_expense: '其他',
}
const CAT_COLOR: Record<string, string> = {
  entertainment: '#E09A3A', other_expense: '#6B6456', health: '#52B788',
  transport: '#4AABB8', utilities: '#E07B5A', shopping: '#C26A8E',
  food: '#7BB8A0', goal_deposit: '#9B8AC4', impulse: '#D4944A',
  salary: '#52B788', investment_income: '#4AABB8', bonus: '#C8A45A',
}

function fmtMoney(n: number) {
  return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const EXPENSE_CATS = Object.entries(TX_CATEGORIES).filter(([, v]) => !v.isIncome).map(([k]) => k)


// ── Category Chinese labels ───────────────────────────────────
const CAT_ZH: Record<string, string> = {
  salary:'薪資', investment_income:'投資收益', bonus:'獎金',
  food:'餐飲', transport:'交通', entertainment:'娛樂',
  shopping:'購物', health:'醫療', utilities:'帳單',
  goal_deposit:'目標存款', impulse:'衝動消費', other_expense:'其他',
}

// ── Wallet data loader (client-only, no-render component) ─────
// Separated so hooks are always called unconditionally
function WalletLoaderInner({
  year, month, onData, onLoading, kit,
}: {
  year: number; month: number
  onData: (d: Record<string, OnChainDayRecord>) => void
  onLoading: (v: boolean) => void
  kit: NonNullable<ReturnType<typeof getDAppKit>>
}) {
  const conn = useWalletConnection({ dAppKit: kit })

  useEffect(() => {
    if (!conn.isConnected || !conn.account?.address) {
      onData({})
      return
    }
    onLoading(true)
    fetchMonthOnChainData(conn.account.address, year, month)
      .then(d => { onData(d); onLoading(false) })
      .catch(() => { onData({}); onLoading(false) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conn.isConnected, conn.account?.address, year, month])

  return null
}

function WalletCalendarLoader(props: {
  year: number; month: number
  onData: (d: Record<string, OnChainDayRecord>) => void
  onLoading: (v: boolean) => void
}) {
  const kit = useMemo(() => getDAppKit(), [])
  if (!kit) return null
  return <WalletLoaderInner {...props} kit={kit} />
}

// ── Mini Calendar ─────────────────────────────────────────────
function MiniCalendar() {
  const { state } = useApp()
  const { transactions, profile } = state

  const [viewDate, setViewDate]   = useState(new Date())
  const [selected, setSelected]   = useState<string | null>(null)
  const [onChainMap, setOnChainMap] = useState<Record<string, OnChainDayRecord>>({})
  const [chainLoading, setChainLoading] = useState(false)
  const [mounted, setMounted]     = useState(false)

  useEffect(() => { setMounted(true) }, [])

  const year     = viewDate.getFullYear()
  const month    = viewDate.getMonth() + 1
  const todayStr = format(new Date(), 'yyyy-MM-dd')

  const calData = useMemo(
    () => txService.getCalendarData(year, month),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [year, month, transactions.length]
  )

  const firstDow  = getDay(startOfMonth(viewDate))
  const daysInMon = getDaysInMonth(viewDate)
  const cells = [
    ...Array.from({ length: firstDow }, (_, i) => ({ empty: true, key: `e${i}` })),
    ...Array.from({ length: daysInMon }, (_, i) => {
      const d = `${year}-${String(month).padStart(2,'0')}-${String(i+1).padStart(2,'0')}`
      return { empty: false, key: d, date: d, day: i + 1 }
    }),
  ]

  const selRec   = selected ? calData[selected]   : null
  const selChain = selected ? onChainMap[selected] : null

  function nav(delta: -1 | 1) {
    setViewDate(v => delta === -1 ? subMonths(v, 1) : addMonths(v, 1))
    setSelected(null)
    setOnChainMap({})
  }

  return (
    <div style={{ ...CARD_S, padding: '24px' }}>

      {/* Invisible data-loader (client-only, mounts after hydration) */}
      {mounted && (
        <WalletCalendarLoader
          year={year} month={month}
          onData={setOnChainMap}
          onLoading={setChainLoading}
        />
      )}

      {/* ── Header ─────────────────────────────── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'18px' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <p style={{ color:TEXT, fontSize:'14px', fontWeight:600 }}>月曆記帳</p>
          {chainLoading && <span style={{ color:MUTED, fontSize:'10px' }}>讀取鏈上資料…</span>}
        </div>

        {/* Month navigator */}
        <div style={{ display:'flex', alignItems:'center', gap:'4px' }}>
          <button onClick={() => nav(-1)}
            style={{ width:'28px', height:'28px', borderRadius:'5px', border:`1px solid ${BORDER}`, background:'#1A1915', color:MUTED, cursor:'pointer', fontSize:'15px', display:'flex', alignItems:'center', justifyContent:'center' }}>‹</button>
          <span style={{ color:TEXT, fontSize:'13px', fontWeight:500, minWidth:'80px', textAlign:'center' }}>
            {year}年{month}月
          </span>
          <button onClick={() => nav(1)}
            style={{ width:'28px', height:'28px', borderRadius:'5px', border:`1px solid ${BORDER}`, background:'#1A1915', color:MUTED, cursor:'pointer', fontSize:'15px', display:'flex', alignItems:'center', justifyContent:'center' }}>›</button>
        </div>

        {/* Legend */}
        <div style={{ display:'flex', gap:'12px', fontSize:'11px', color:MUTED }}>
          {[
            { c:'#52B788', label:'達標' },
            { c:'#F4A261', label:'超支' },
            { c:'#818cf8', label:'鏈上' },
          ].map(({ c, label }) => (
            <span key={label} style={{ display:'flex', alignItems:'center', gap:'4px' }}>
              <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:c, display:'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      {/* ── Weekday headers ─────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'6px' }}>
        {['日','一','二','三','四','五','六'].map(d => (
          <div key={d} style={{ textAlign:'center', fontSize:'11px', color:MUTED, padding:'4px 0', fontWeight:500 }}>{d}</div>
        ))}
      </div>

      {/* ── Day grid ────────────────────────────── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'3px' }}>
        {cells.map(cell => {
          if (cell.empty) return <div key={cell.key} />
          const { date, day } = cell as { date: string; day: number; empty: false; key: string }
          const isToday    = date === todayStr
          const isSelected = date === selected
          const isFuture   = date > todayStr
          const rec        = calData[date]
          const chain      = onChainMap[date]
          const hasLocal   = !!(rec && rec.totalExpense > 0)
          const hasChain   = !!(chain && chain.txCount > 0)
          const overBudget = rec ? rec.totalExpense > profile.dailyBudget : false

          return (
            <button
              key={date}
              onClick={() => !isFuture && setSelected(p => p === date ? null : date)}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center',
                padding:'7px 2px 4px', borderRadius:'6px', border:'none',
                cursor: isFuture ? 'default' : 'pointer',
                background: isSelected ? 'rgba(200,164,90,0.2)' : isToday ? 'rgba(200,164,90,0.09)' : 'transparent',
                outline: isSelected ? '1.5px solid rgba(200,164,90,0.6)' : isToday ? '1px solid rgba(200,164,90,0.35)' : 'none',
              }}
            >
              <span style={{ fontSize:'12px', lineHeight:1, color: isToday ? GOLD : isFuture ? MUTED+'40' : TEXT, fontWeight: isToday ? 700 : 400 }}>
                {day}
              </span>
              {/* Dots row — local dot + chain dot side by side */}
              <div style={{ height:'7px', marginTop:'3px', display:'flex', gap:'3px', alignItems:'center' }}>
                {hasLocal && !isFuture && (
                  <div style={{ width:'5px', height:'5px', borderRadius:'50%', background: overBudget ? '#F4A261' : '#52B788', boxShadow: overBudget ? '0 0 3px rgba(244,162,97,0.5)' : '0 0 3px rgba(82,183,136,0.5)' }} />
                )}
                {hasChain && !isFuture && (
                  <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:'#818cf8', boxShadow:'0 0 3px rgba(129,140,248,0.6)' }} />
                )}
              </div>
            </button>
          )
        })}
      </div>

      {/* ── Selected day popup ──────────────────── */}
      {selected && (selRec || selChain) && (
        <div style={{ marginTop:'16px', paddingTop:'16px', borderTop:`1px solid ${BORDER}`, animation:'fadeUp 0.22s ease' }}>

          {/* === Local transactions === */}
          {selRec && (() => {
            const overDay = selRec.totalExpense > profile.dailyBudget
            return (
              <>
                {/* Summary */}
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                  <div>
                    <p style={{ color:GOLD, fontSize:'12px', fontWeight:600 }}>{selected}</p>
                    <p style={{ color:MUTED, fontSize:'10px', marginTop:'2px' }}>{selRec.transactions.length} 筆本地記帳</p>
                  </div>
                  <div style={{ display:'flex', gap:'14px', textAlign:'right' }}>
                    {[
                      { l:'收入', v:`+NT$${selRec.totalIncome.toLocaleString()}`,                     c:'#52B788' },
                      { l:'支出', v:`−NT$${selRec.totalExpense.toLocaleString()}`,                    c: overDay ? '#F4A261' : '#E07B5A' },
                      { l:'淨額', v:`${selRec.net>=0?'+':''}NT$${selRec.net.toLocaleString()}`,       c: selRec.net>=0 ? '#52B788' : '#E07B5A' },
                    ].map(({ l, v, c }) => (
                      <div key={l}>
                        <p style={{ color:MUTED, fontSize:'9px', letterSpacing:'1px' }}>{l}</p>
                        <p style={{ fontFamily:SERIF, color:c, fontSize:'13px', marginTop:'2px' }}>{v}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Budget bar */}
                {selRec.totalExpense > 0 && (
                  <div style={{ marginBottom:'12px' }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'10px', color:MUTED, marginBottom:'4px' }}>
                      <span>每日預算</span>
                      <span style={{ color: overDay ? '#F4A261' : '#52B788' }}>
                        NT${selRec.totalExpense.toLocaleString()} / NT${profile.dailyBudget.toLocaleString()}
                      </span>
                    </div>
                    <div style={{ height:'4px', background:BORDER, borderRadius:'2px', overflow:'hidden' }}>
                      <div style={{ height:'100%', borderRadius:'2px', transition:'width 0.4s ease',
                        width:`${Math.min((selRec.totalExpense/profile.dailyBudget)*100, 100)}%`,
                        background: overDay ? 'linear-gradient(90deg,#F4A261,#E07B5A)' : 'linear-gradient(90deg,#3D9B72,#52B788)',
                      }} />
                    </div>
                  </div>
                )}

                {/* Tx list */}
                <div style={{ display:'flex', flexDirection:'column', gap:'1px', marginBottom: selChain ? '14px' : '0' }}>
                  {selRec.transactions.length === 0
                    ? <p style={{ color:MUTED, fontSize:'11px', textAlign:'center', padding:'8px 0' }}>當天無本地記帳</p>
                    : selRec.transactions.map((tx, i) => (
                        <div key={tx.id} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 10px', borderRadius:'5px', background: i%2===0 ? 'rgba(22,22,18,0.6)' : 'transparent' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'26px', height:'26px', borderRadius:'5px', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', background: tx.isIncome ? 'rgba(82,183,136,0.1)' : 'rgba(224,123,90,0.1)' }}>
                              {TX_CATEGORIES[tx.category as keyof typeof TX_CATEGORIES]?.emoji || '💰'}
                            </div>
                            <div>
                              <p style={{ color:TEXT, fontSize:'12px', fontWeight:500 }}>{tx.note || CAT_ZH[tx.category] || tx.category}</p>
                              <p style={{ color:MUTED, fontSize:'10px', marginTop:'1px' }}>
                                {CAT_ZH[tx.category] || tx.category}
                                {tx.isImpulse && <span style={{ color:'#F4A261', marginLeft:'6px' }}>⚡</span>}
                              </p>
                            </div>
                          </div>
                          <p style={{ fontFamily:SERIF, fontSize:'13px', color: tx.isIncome ? '#52B788' : '#E07B5A' }}>
                            {tx.isIncome ? '+' : '−'}NT${tx.amount.toLocaleString()}
                          </p>
                        </div>
                    ))
                  }
                </div>
              </>
            )
          })()}

          {/* === On-chain section === */}
          {selChain && (
            <div style={{ borderTop: selRec ? `1px solid ${BORDER}` : 'none', paddingTop: selRec ? '14px' : '0' }}>
              {/* Chain header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'10px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                  <div style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#818cf8' }} />
                  <p style={{ color:'#818cf8', fontSize:'12px', fontWeight:600 }}>區塊鏈紀錄</p>
                  <span style={{ color:MUTED, fontSize:'10px' }}>{selChain.txCount} 筆</span>
                </div>
                <div style={{ display:'flex', gap:'14px', textAlign:'right' }}>
                  <div>
                    <p style={{ color:MUTED, fontSize:'9px' }}>SUI 收入</p>
                    <p style={{ fontFamily:SERIF, color:'#52B788', fontSize:'12px', marginTop:'2px' }}>+{selChain.suiIn.toFixed(4)}</p>
                  </div>
                  <div>
                    <p style={{ color:MUTED, fontSize:'9px' }}>SUI 支出</p>
                    <p style={{ fontFamily:SERIF, color:'#E07B5A', fontSize:'12px', marginTop:'2px' }}>−{selChain.suiOut.toFixed(4)}</p>
                  </div>
                </div>
              </div>

              {/* Per-tx entries */}
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {selChain.entries.map(entry => (
                  <div key={entry.digest} style={{ background:'rgba(129,140,248,0.05)', border:'1px solid rgba(129,140,248,0.15)', borderRadius:'6px', padding:'10px 12px' }}>
                    {/* Digest + link */}
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'6px' }}>
                      <p style={{ color:'#818cf8', fontSize:'10px', fontFamily:'monospace' }}>
                        {entry.digest.slice(0,10)}…{entry.digest.slice(-6)}
                      </p>
                      <a href={`https://suiscan.xyz/testnet/tx/${entry.digest}`} target="_blank" rel="noopener noreferrer"
                        style={{ color:GOLD, fontSize:'10px', textDecoration:'none' }}>↗ SuiScan</a>
                    </div>

                    {/* Balance */}
                    {(entry.suiIn > 0 || entry.suiOut > 0) && (
                      <div style={{ display:'flex', gap:'12px', fontSize:'11px', marginBottom: entry.objectsCreated + entry.objectsMutated + entry.objectsDeleted > 0 ? '6px' : '0' }}>
                        {entry.suiIn  > 0 && <span style={{ color:'#52B788' }}>+{entry.suiIn.toFixed(4)} SUI</span>}
                        {entry.suiOut > 0 && <span style={{ color:'#E07B5A' }}>−{entry.suiOut.toFixed(4)} SUI</span>}
                        {entry.gasFee > 0 && <span style={{ color:MUTED }}>費 {entry.gasFee.toFixed(6)}</span>}
                      </div>
                    )}

                    {/* Object changes */}
                    {(entry.objectsCreated + entry.objectsMutated + entry.objectsDeleted > 0) && (
                      <div>
                        <p style={{ color:MUTED, fontSize:'9px', letterSpacing:'1px', marginBottom:'4px' }}>物件變動</p>
                        <div style={{ display:'flex', gap:'6px', flexWrap:'wrap', marginBottom:'4px' }}>
                          {entry.objectsCreated > 0 && <span style={{ background:'rgba(82,183,136,0.1)', color:'#52B788', fontSize:'10px', padding:'2px 6px', borderRadius:'3px' }}>＋{entry.objectsCreated} 建立</span>}
                          {entry.objectsMutated > 0 && <span style={{ background:'rgba(200,164,90,0.1)', color:GOLD,     fontSize:'10px', padding:'2px 6px', borderRadius:'3px' }}>✎ {entry.objectsMutated} 修改</span>}
                          {entry.objectsDeleted > 0 && <span style={{ background:'rgba(224,123,90,0.1)', color:'#E07B5A', fontSize:'10px', padding:'2px 6px', borderRadius:'3px' }}>× {entry.objectsDeleted} 刪除</span>}
                        </div>
                        {entry.objectDetails.slice(0, 3).map((obj, i) => (
                          <p key={i} style={{ color:MUTED, fontSize:'9px', fontFamily:'monospace', marginTop:'2px' }}>
                            {obj.changeType==='created'?'＋':obj.changeType==='deleted'?'－':'≈'} {obj.type}
                          </p>
                        ))}
                        {entry.objectDetails.length > 3 && (
                          <p style={{ color:MUTED, fontSize:'9px', marginTop:'2px' }}>⋯ 還有 {entry.objectDetails.length-3} 個</p>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Goal Cards ────────────────────────────────────────────────

const ALLOC_INFO = [
  { key: 'livingPct',    label: '生活費',   color: '#52B788' },
  { key: 'savingsPct',   label: '目標儲蓄', color: '#C8A45A' },
  { key: 'emergencyPct', label: '緊急備用', color: '#4AABB8' },
  { key: 'investmentPct', label: '投資理財', color: '#8b5cf6' },
] as const

function GoalCards() {
  const { state } = useApp()
  const { goals, profile, transactions } = state

  const todayStr     = format(new Date(), 'yyyy-MM-dd')
  const todayExpense = transactions
    .filter(t => t.date === todayStr && !t.isIncome)
    .reduce((s, t) => s + t.amount, 0)
  const remainingToday = Math.max(0, profile.dailyBudget - todayExpense)

  const active = goals.filter(g => g.status === 'active')

  if (active.length === 0) return (
    <div style={{
      ...CARD_S, padding: '24px', textAlign: 'center',
      borderStyle: 'dashed', borderColor: 'rgba(200,164,90,0.25)',
    }}>
      <p style={{ fontSize: '28px', marginBottom: '8px' }}>🎯</p>
      <p style={{ color: TEXT, fontSize: '13px', fontWeight: 500, marginBottom: '4px' }}>尚無存錢目標</p>
      <p style={{ color: MUTED, fontSize: '11px' }}>前往「財務目標」頁面新增目標</p>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      {active.map(goal => (
        <GoalCardItem
          key={goal.id}
          goal={goal}
          profile={profile}
          remainingToday={remainingToday}
          todayExpense={todayExpense}
        />
      ))}
    </div>
  )
}

function GoalCardItem({ goal, profile, remainingToday, todayExpense }: {
  goal: Goal
  profile: UserProfile
  remainingToday: number
  todayExpense: number
}) {
  const [showBreakdown, setShowBreakdown] = useState(false)

  const dailyNeeded  = goal.monthlyGap > 0 ? Math.ceil(goal.monthlyGap / 30) : 0
  const remaining    = Math.max(0, goal.targetAmount - goal.currentAmount)
  const deadlineDate = new Date(goal.deadlineMs)
  const pct          = goal.progressPct
  const barColor     = goal.color || GOLD

  const alloc = useMemo(
    () => financeService.calcAllocation(goal, profile.monthlyIncome),
    [goal, profile.monthlyIncome],
  )

  return (
    <div style={{
      ...CARD_S,
      padding: '22px',
      borderLeft: `3px solid ${barColor}`,
      position: 'relative', overflow: 'hidden',
      cursor: 'pointer',
    }}
      onClick={() => setShowBreakdown(v => !v)}
    >
      {/* Subtle corner glow */}
      <div style={{
        position: 'absolute', top: 0, right: 0,
        width: '100px', height: '100px',
        background: `radial-gradient(circle at top right, ${barColor}10, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* ── Row 1: name + deadline + pct ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '14px' }}>
        <div>
          <p style={{ color: TEXT, fontSize: '15px', fontWeight: 600 }}>
            {goal.emoji} {goal.name}
          </p>
          <p style={{ color: MUTED, fontSize: '11px', marginTop: '3px' }}>
            截止日期：{deadlineDate.toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' })}
            <span style={{ margin: '0 6px', opacity: 0.4 }}>·</span>
            剩餘 {goal.daysLeft} 天
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ textAlign: 'right' }}>
            <p style={{ fontFamily: SERIF, fontSize: '26px', fontWeight: 400, color: barColor, lineHeight: 1 }}>
              {pct}%
            </p>
            <p style={{ color: MUTED, fontSize: '10px', marginTop: '2px' }}>進度</p>
          </div>
          <ChevronDown
            size={16}
            color={MUTED}
            style={{ transform: showBreakdown ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s' }}
          />
        </div>
      </div>

      {/* ── Progress bar ── */}
      <div style={{ height: '7px', background: '#2C2920', borderRadius: '4px', overflow: 'hidden', marginBottom: '16px' }}>
        <div style={{
          height: '100%',
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${barColor}99, ${barColor})`,
          borderRadius: '4px',
          boxShadow: `0 0 8px ${barColor}55`,
          transition: 'width 0.6s ease',
        }} />
      </div>

      {/* ── Row 2: 3 stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', marginBottom: '14px' }}>
        {[
          { label: '目前存款', value: `NT$${goal.currentAmount.toLocaleString()}`, color: TEXT },
          { label: '目標金額', value: `NT$${goal.targetAmount.toLocaleString()}`, color: TEXT },
          { label: '尚需金額', value: `NT$${remaining.toLocaleString()}`,         color: remaining > 0 ? EXPENSE_C : INCOME_C },
        ].map(({ label, value, color }) => (
          <div key={label} style={{ background: '#1A1915', borderRadius: '6px', padding: '10px 12px', border: `1px solid ${BORDER}` }}>
            <p style={{ color: MUTED, fontSize: '9px', letterSpacing: '1.5px', marginBottom: '5px' }}>{label}</p>
            <p style={{ fontFamily: SERIF, color, fontSize: '13px' }}>{value}</p>
          </div>
        ))}
      </div>

      {/* ── Divider ── */}
      <div style={{ height: '1px', background: BORDER, marginBottom: '14px' }} />

      {/* ── Row 3: daily info ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <div style={{ background: '#1A1915', borderRadius: '6px', padding: '12px 14px', border: `1px solid ${BORDER}` }}>
          <p style={{ color: MUTED, fontSize: '9px', letterSpacing: '1.5px', marginBottom: '6px' }}>今日剩餘可用開銷</p>
          <p style={{
            fontFamily: SERIF, fontSize: '18px', fontWeight: 600,
            color: remainingToday > 0 ? INCOME_C : EXPENSE_C,
          }}>
            NT${remainingToday.toLocaleString()}
          </p>
          <p style={{ color: MUTED, fontSize: '10px', marginTop: '3px' }}>
            已用 NT${todayExpense.toLocaleString()} / 預算 NT${profile.dailyBudget.toLocaleString()}
          </p>
        </div>
        <div style={{ background: '#1A1915', borderRadius: '6px', padding: '12px 14px', border: `1px solid ${BORDER}` }}>
          <p style={{ color: MUTED, fontSize: '9px', letterSpacing: '1.5px', marginBottom: '6px' }}>每日需存金額</p>
          <p style={{ fontFamily: SERIF, fontSize: '18px', fontWeight: 600, color: barColor }}>
            NT${dailyNeeded.toLocaleString()}
          </p>
          <p style={{ color: MUTED, fontSize: '10px', marginTop: '3px' }}>
            每月需存 NT${goal.monthlyGap.toLocaleString()}
          </p>
        </div>
      </div>

      {/* ── 分配明細展開（點擊目標顯示） ── */}
      {showBreakdown && (
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: `1px solid ${BORDER}` }}
          onClick={e => e.stopPropagation()}
        >
          <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '1.5px', marginBottom: '12px' }}>
            智慧資金分配（依剩餘時間自動每日更新）
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {ALLOC_INFO.map(item => {
              const pctVal = alloc[item.key]
              return (
                <div key={item.key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                    <span style={{ color: TEXT, fontSize: '12px' }}>{item.label}</span>
                    <span style={{ color: item.color, fontSize: '12px', fontFamily: SERIF, fontWeight: 600 }}>{pctVal}%</span>
                  </div>
                  <div style={{ height: '5px', background: BORDER, borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{
                      height: '100%',
                      width: `${pctVal}%`,
                      background: item.color,
                      borderRadius: '3px',
                      transition: 'width 0.5s ease',
                    }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Custom Tooltip ────────────────────────────────────────────
function GoldTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name?: string }[]; label?: string }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#1A1915', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '8px 12px', fontSize: '12px', color: TEXT }}>
      {label && <p style={{ color: MUTED, marginBottom: '4px', fontSize: '11px' }}>{label}</p>}
      <p style={{ color: GOLD, fontFamily: SERIF, fontWeight: 700 }}>{fmtMoney(payload[0].value)}</p>
    </div>
  )
}

// ── Main Component ────────────────────────────────────────────
export function DashboardPage() {
  const { state } = useApp()
  const { transactions } = state

  const todayStr     = useMemo(() => format(new Date(), 'yyyy-MM-dd'), [])
  const defaultStart = useMemo(() => format(startOfMonth(new Date()), 'yyyy-MM-dd'), [])
  const nowHour      = new Date().getHours()
  const greeting     = nowHour < 12 ? '早安' : nowHour < 18 ? '午安' : '晚安'

  const [startDate, setStartDate]         = useState(defaultStart)
  const [endDate, setEndDate]             = useState(todayStr)
  const [quickSelect, setQuickSelect]     = useState('本月')
  const [trendCat, setTrendCat]           = useState('transport')
  const [showQuick, setShowQuick]         = useState(false)

  const QUICK_OPTIONS = ['本月', '上月', '近三個月', '今年']

  function applyQuick(val: string) {
    setQuickSelect(val); setShowQuick(false)
    const now = new Date()
    if (val === '本月')      { setStartDate(format(startOfMonth(now),'yyyy-MM-dd')); setEndDate(format(now,'yyyy-MM-dd')) }
    else if (val === '上月') { const l=subMonths(now,1); setStartDate(format(startOfMonth(l),'yyyy-MM-dd')); setEndDate(format(endOfMonth(l),'yyyy-MM-dd')) }
    else if (val === '近三個月') { setStartDate(format(subMonths(now,3),'yyyy-MM-dd')); setEndDate(format(now,'yyyy-MM-dd')) }
    else if (val === '今年')  { setStartDate(format(startOfYear(now),'yyyy-MM-dd')); setEndDate(format(now,'yyyy-MM-dd')) }
  }

  // ── Data ─────────────────────────────────────────────────
  const filtered     = useMemo(() => transactions.filter(t => t.date >= startDate && t.date <= endDate), [transactions, startDate, endDate])
  const totalIncome  = useMemo(() => filtered.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0), [filtered])
  const totalExpense = useMemo(() => filtered.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0), [filtered])
  const totalBalance = totalIncome - totalExpense
  const spentToday   = useMemo(() => transactions.filter(t => t.date === todayStr && !t.isIncome).reduce((s, t) => s + t.amount, 0), [transactions, todayStr])

  const pieData = useMemo(() => {
    const map = new Map<string, number>()
    filtered.filter(t => !t.isIncome).forEach(t => map.set(t.category, (map.get(t.category)||0) + t.amount))
    return Array.from(map.entries())
      .map(([cat, value]) => ({ name: CAT_EN[cat]||cat, value, color: CAT_COLOR[cat]||'#6B6456' }))
      .sort((a, b) => b.value - a.value)
  }, [filtered])

  const trendData = useMemo(() => {
    const map = new Map<string, number>()
    transactions.filter(t => t.date >= startDate && t.date <= endDate && !t.isIncome && t.category === trendCat)
      .forEach(t => map.set(t.date, (map.get(t.date)||0) + t.amount))
    const days = eachDayOfInterval({ start: parseISO(startDate), end: parseISO(endDate) })
    return days.map(d => ({ date: format(d,'MM/dd'), amount: map.get(format(d,'yyyy-MM-dd'))||0 }))
  }, [transactions, startDate, endDate, trendCat])

  const noData = pieData.length === 0

  // ── Input style ───────────────────────────────────────────
  const inputS: React.CSSProperties = {
    background: '#1A1915', border: `1px solid ${BORDER}`, borderRadius: '4px',
    color: TEXT, padding: '5px 10px', fontSize: '12px', outline: 'none',
    fontFamily: '-apple-system, Helvetica Neue, sans-serif',
  }

  return (
    <div style={{ padding: '28px 32px 40px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* ── Welcome header ─────────────────────────────────── */}
      <div className="fade-up" style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: '4px' }}>
        <div>
          <p style={{ color: MUTED, fontSize: '11px', letterSpacing: '2px', marginBottom: '4px' }}>
            {new Date().toLocaleDateString('zh-TW', { year:'numeric', month:'long', day:'numeric', weekday:'long' })}
          </p>
          <h1 style={{ color: TEXT, fontSize: '22px', fontWeight: 300, letterSpacing: '-0.3px' }}>
            {greeting}，<span style={{ color: GOLD, fontWeight: 600 }}>使用者</span>
          </h1>
        </div>

        {/* Date range selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', position: 'relative' }}>
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setShowQuick(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px',
                background: '#1A1915', border: `1px solid ${BORDER}`, borderRadius: '4px',
                color: GOLD, fontSize: '12px', fontWeight: 500, cursor: 'pointer',
              }}
            >
              {quickSelect}
              <ChevronDown size={12} />
            </button>
            {showQuick && (
              <div style={{
                position: 'absolute', right: 0, top: '100%', marginTop: '4px',
                background: '#1A1915', border: `1px solid ${BORDER}`, borderRadius: '6px',
                overflow: 'hidden', zIndex: 50, minWidth: '150px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}>
                {QUICK_OPTIONS.map(opt => (
                  <button
                    key={opt}
                    onClick={() => applyQuick(opt)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '9px 14px', background: opt === quickSelect ? GOLD_DIM : 'transparent',
                      border: 'none', color: opt === quickSelect ? GOLD : TEXT,
                      fontSize: '12px', cursor: 'pointer',
                    }}
                  >
                    {opt}
                  </button>
                ))}
              </div>
            )}
          </div>
          <input type="date" value={startDate}
            onChange={e => { setStartDate(e.target.value); setQuickSelect('自訂') }}
            style={inputS}
          />
          <span style={{ color: MUTED, fontSize: '12px' }}>—</span>
          <input type="date" value={endDate}
            onChange={e => { setEndDate(e.target.value); setQuickSelect('自訂') }}
            style={inputS}
          />
        </div>
      </div>

      {/* ── Gold divider ───────────────────────────────────── */}
      <div style={{ height: '1px', background: `linear-gradient(90deg, ${GOLD_BDR}, transparent 60%)` }} />

      {/* ── Primary Balance Hero ───────────────────────────── */}
      <div className="fade-up-1" style={{
        ...CARD_S, padding: '28px 32px',
        background: `linear-gradient(135deg, #1A1915 0%, ${CARD} 100%)`,
        borderColor: GOLD_BDR, position: 'relative', overflow: 'hidden',
      }}>
        {/* Decorative corner */}
        <div style={{
          position: 'absolute', top: 0, right: 0,
          width: '120px', height: '120px',
          background: `radial-gradient(circle at top right, rgba(200,164,90,0.07), transparent 70%)`,
          pointerEvents: 'none',
        }} />
        <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '3px', marginBottom: '12px' }}>
          總餘額
        </p>
        <p style={{ fontFamily: SERIF, fontSize: '52px', fontWeight: 400, color: TEXT, letterSpacing: '-1px', lineHeight: 1 }}>
          {fmtMoney(totalBalance)}
        </p>
        <div style={{ display: 'flex', gap: '32px', marginTop: '20px' }}>
          <div>
            <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '1.5px', marginBottom: '4px' }}>收入</p>
            <p style={{ color: INCOME_C, fontFamily: SERIF, fontSize: '18px', fontWeight: 400 }}>
              ↑ {fmtMoney(totalIncome)}
            </p>
          </div>
          <div style={{ width: '1px', background: BORDER }} />
          <div>
            <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '1.5px', marginBottom: '4px' }}>支出</p>
            <p style={{ color: EXPENSE_C, fontFamily: SERIF, fontSize: '18px', fontWeight: 400 }}>
              ↓ {fmtMoney(totalExpense)}
            </p>
          </div>
          <div style={{ width: '1px', background: BORDER }} />
          <div>
            <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '1.5px', marginBottom: '4px' }}>今日支出</p>
            <p style={{ color: EXPENSE_C, fontFamily: SERIF, fontSize: '18px', fontWeight: 400 }}>
              {fmtMoney(spentToday)}
            </p>
          </div>
          <button
            title="匯出"
            style={{
              marginLeft: 'auto', width: '32px', height: '32px', borderRadius: '4px',
              background: '#1A1915', border: `1px solid ${BORDER}`,
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: MUTED, alignSelf: 'flex-end',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = GOLD)}
            onMouseLeave={e => (e.currentTarget.style.color = MUTED)}
          >
            <Download size={14} />
          </button>
        </div>
      </div>

      {/* ── Income / Expense detail cards ──────────────────── */}
      <div className="fade-up-2" style={GRID3}>
        {/* Income */}
        <div style={{ ...CARD_S, padding: '20px', borderLeftColor: INCOME_C, borderLeftWidth: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '2px' }}>收入</p>
            <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'rgba(82,183,136,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowUpRight size={14} color={INCOME_C} />
            </div>
          </div>
          <p style={{ fontFamily: SERIF, fontSize: '24px', color: INCOME_C, letterSpacing: '-0.5px' }}>{fmtMoney(totalIncome)}</p>
        </div>

        {/* Expense */}
        <div style={{ ...CARD_S, padding: '20px', borderLeftColor: EXPENSE_C, borderLeftWidth: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '2px' }}>支出</p>
            <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: 'rgba(224,123,90,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <ArrowDownRight size={14} color={EXPENSE_C} />
            </div>
          </div>
          <p style={{ fontFamily: SERIF, fontSize: '24px', color: EXPENSE_C, letterSpacing: '-0.5px' }}>{fmtMoney(totalExpense)}</p>
        </div>

        {/* Savings rate */}
        <div style={{ ...CARD_S, padding: '20px', borderLeftColor: GOLD, borderLeftWidth: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '2px' }}>儲蓄率</p>
            <div style={{ width: '28px', height: '28px', borderRadius: '4px', background: GOLD_DIM, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <TrendingUp size={14} color={GOLD} />
            </div>
          </div>
          <p style={{ fontFamily: SERIF, fontSize: '24px', color: GOLD, letterSpacing: '-0.5px' }}>
            {totalIncome > 0 ? Math.round(((totalIncome - totalExpense) / totalIncome) * 100) : 0}%
          </p>
        </div>
      </div>

      {/* ── Yearly Overview ────────────────────────────────── */}
      {/* ── Savings Goals ──────────────────────────────────── */}
      <div className="fade-up-3">
        <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '3px', marginBottom: '12px' }}>存錢目標</p>
        <GoalCards />
      </div>

      {/* ── Charts ─────────────────────────────────────────── */}
      <div className="fade-up-5" style={GRID2}>

        {/* Donut — Expenses by Category */}
        <div style={{ ...CARD_S, padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <p style={{ color: TEXT, fontSize: '13px', fontWeight: 600 }}>各類別支出</p>
            <p style={{ color: MUTED, fontSize: '10px', letterSpacing: '1px' }}>{filtered.length} 筆交易</p>
          </div>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            {/* Legend */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', minWidth: '115px' }}>
              {(noData ? [{ name: '無資料', color: BORDER }] : pieData.slice(0, 8)).map(c => (
                <div key={c.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '2px', background: c.color, flexShrink: 0 }} />
                  <span style={{ color: MUTED, fontSize: '11px' }}>{c.name}</span>
                </div>
              ))}
            </div>
            {/* Chart */}
            <div style={{ flex: 1, height: '200px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={noData ? [{ name: '無資料', value: 1 }] : pieData}
                    cx="50%" cy="50%"
                    innerRadius="42%" outerRadius="76%"
                    dataKey="value" strokeWidth={3} stroke={CARD}
                    paddingAngle={noData ? 0 : 2}
                  >
                    {(noData ? [{ color: BORDER }] : pieData).map((e, i) => (
                      <Cell key={i} fill={e.color} />
                    ))}
                  </Pie>
                  <Tooltip content={<GoldTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Area — Consumption Trend */}
        <div style={{ ...CARD_S, padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '18px' }}>
            <p style={{ color: TEXT, fontSize: '13px', fontWeight: 600 }}>消費趨勢</p>
            <select
              value={trendCat}
              onChange={e => setTrendCat(e.target.value)}
              style={{
                background: '#1A1915', border: `1px solid ${BORDER}`, borderRadius: '4px',
                color: GOLD, padding: '4px 8px', fontSize: '11px', outline: 'none', cursor: 'pointer',
              }}
            >
              {EXPENSE_CATS.map(cat => (
                <option key={cat} value={cat}>{CAT_EN[cat]||cat}</option>
              ))}
            </select>
          </div>
          <div style={{ height: '200px' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="goldGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={GOLD} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={GOLD} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke={BORDER} vertical={false} />
                <XAxis
                  dataKey="date"
                  tick={{ fill: MUTED, fontSize: 10 }}
                  axisLine={{ stroke: BORDER }}
                  tickLine={false}
                  interval={Math.max(0, Math.floor(trendData.length / 6) - 1)}
                />
                <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
                <Tooltip content={<GoldTooltip />} />
                <Area
                  type="monotone" dataKey="amount"
                  stroke={GOLD} strokeWidth={2}
                  fill="url(#goldGrad)"
                  dot={false}
                  activeDot={{ r: 4, fill: GOLD, stroke: CARD, strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Calendar ───────────────────────────────────────── */}
      <div className="fade-up-6">
        <MiniCalendar />
      </div>

    </div>
  )
}
