'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, AlertTriangle, ChevronDown, Clock } from 'lucide-react'
import { useApp } from '@/lib/store'
import { TX_CATEGORIES } from '@/lib/constants'
import type { TxCategory } from '@/types'

interface Props { open: boolean; onClose: () => void }

const EXPENSE_CATS = Object.entries(TX_CATEGORIES).filter(([, v]) => !v.isIncome).map(([k, v]) => ({ key: k as TxCategory, ...v }))
const INCOME_CATS  = Object.entries(TX_CATEGORIES).filter(([, v]) => v.isIncome ).map(([k, v]) => ({ key: k as TxCategory, ...v }))

const GOLD   = '#C8A45A'
const CARD   = '#161612'
const BORDER = '#2C2920'
const TEXT   = '#F0EDE6'
const MUTED  = '#6B6456'
const SERIF  = "Georgia, 'Times New Roman', serif"

export function AddTransactionModal({ open, onClose }: Props) {
  const { state, actions } = useApp()
  const { goals, profile } = state

  const [amount, setAmount]       = useState('')
  const [isIncome, setIsIncome]   = useState(false)
  const [category, setCategory]   = useState<TxCategory>('food')
  const [note, setNote]           = useState('')
  const [goalId, setGoalId]       = useState<string>('')
  const [isImpulse, setIsImpulse] = useState(false)
  const [saved, setSaved]         = useState(false)

  const cats = isIncome ? INCOME_CATS : EXPENSE_CATS

  function reset() {
    setAmount(''); setIsIncome(false); setCategory('food')
    setNote(''); setGoalId(''); setIsImpulse(false); setSaved(false)
  }
  function handleClose() { reset(); onClose() }
  function handleSubmit() {
    if (!amount || isNaN(Number(amount)) || Number(amount) <= 0) return
    actions.addTransaction({ amount: Number(amount), isIncome, category, note, timestampMs: Date.now(), goalId: goalId||null, txDigest: null, isImpulse })
    setSaved(true)
    setTimeout(() => handleClose(), 800)
  }

  const spendingAlert = useMemo(
    () => actions.calcSpendingAlert(Number(amount)||0, isIncome),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [amount, isIncome, state.transactions, state.profile.dailyBudget, state.goals]
  )

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:40, backdropFilter:'blur(6px)' }}
            initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
            onClick={handleClose}
          />

          {/* Sheet */}
          <motion.div
            style={{
              position:'fixed', bottom:0, left:'50%', transform:'translateX(-50%)',
              width:'100%', maxWidth:'520px', zIndex:50,
              background: CARD,
              borderTop: `1px solid rgba(200,164,90,0.3)`,
              borderLeft: `1px solid ${BORDER}`,
              borderRight: `1px solid ${BORDER}`,
              borderRadius: '12px 12px 0 0',
              overflow: 'hidden',
            }}
            initial={{ y:'100%' }} animate={{ y:0 }} exit={{ y:'100%' }}
            transition={{ type:'spring', stiffness:280, damping:30 }}
          >
            {/* Gold top bar */}
            <div style={{ height:'2px', background:`linear-gradient(90deg, ${GOLD}, transparent 70%)` }} />

            {/* Handle */}
            <div style={{ display:'flex', justifyContent:'center', padding:'10px 0 4px' }}>
              <div style={{ width:'36px', height:'3px', borderRadius:'2px', background: BORDER }} />
            </div>

            <div style={{ padding:'0 22px 32px', display:'flex', flexDirection:'column', gap:'16px', maxHeight:'88vh', overflowY:'auto' }}>

              {/* Header */}
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                <div>
                  <p style={{ color:TEXT, fontSize:'16px', fontWeight:700, fontFamily:SERIF }}>新增交易</p>
                  <p style={{ color:MUTED, fontSize:'11px', letterSpacing:'1px' }}>記錄收入或支出</p>
                </div>
                <button onClick={handleClose} style={{ background:'none', border:'none', cursor:'pointer', color:MUTED, display:'flex' }}>
                  <X size={18} />
                </button>
              </div>

              {/* Expense / Income toggle */}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', border:`1px solid ${BORDER}`, borderRadius:'6px', overflow:'hidden' }}>
                {[{ label:'支出', value:false }, { label:'收入', value:true }].map(({ label, value }) => (
                  <button
                    key={label}
                    onClick={() => { setIsIncome(value); setCategory(value ? 'salary' : 'food') }}
                    style={{
                      padding:'10px', fontSize:'13px', fontWeight:600, border:'none', cursor:'pointer',
                      background: isIncome === value ? 'rgba(200,164,90,0.1)' : 'transparent',
                      color: isIncome === value ? GOLD : MUTED,
                      borderBottom: isIncome === value ? `2px solid ${GOLD}` : '2px solid transparent',
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* Amount input */}
              <div style={{ display:'flex', alignItems:'baseline', gap:'6px', borderBottom:`1px solid ${BORDER}`, paddingBottom:'14px' }}>
                <span style={{ color:GOLD, fontFamily:SERIF, fontSize:'22px', fontWeight:400 }}>$</span>
                <input
                  type="number" value={amount} onChange={e => setAmount(e.target.value)}
                  placeholder="0.00" autoFocus
                  style={{
                    flex:1, background:'transparent', border:'none', outline:'none',
                    fontFamily:SERIF, fontSize:'38px', fontWeight:400,
                    color:TEXT, minWidth:0, letterSpacing:'-1px',
                  }}
                />
              </div>

              {/* Category grid */}
              <div>
                <p style={{ color:MUTED, fontSize:'9px', letterSpacing:'2.5px', fontWeight:700, marginBottom:'8px' }}>類別</p>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4, 1fr)', gap:'6px' }}>
                  {cats.map(c => (
                    <button
                      key={c.key}
                      onClick={() => setCategory(c.key)}
                      style={{
                        borderRadius:'6px', padding:'9px 4px', cursor:'pointer',
                        border: `1px solid ${category === c.key ? c.color : BORDER}`,
                        background: category === c.key ? `${c.color}15` : '#0C0B09',
                        display:'flex', flexDirection:'column', alignItems:'center', gap:'3px',
                        transition:'all 0.12s',
                      }}
                    >
                      <span style={{ fontSize:'17px' }}>{c.emoji}</span>
                      <span style={{ fontSize:'9px', color:MUTED, textAlign:'center', lineHeight:1.2 }}>{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Note */}
              <div>
                <p style={{ color:MUTED, fontSize:'9px', letterSpacing:'2.5px', fontWeight:700, marginBottom:'6px' }}>備註</p>
                <input
                  type="text" value={note} onChange={e => setNote(e.target.value)}
                  placeholder="選填備註..."
                  style={{
                    width:'100%', background:'#0C0B09', border:`1px solid ${BORDER}`, borderRadius:'5px',
                    padding:'8px 12px', fontSize:'13px', color:TEXT, outline:'none',
                    boxSizing:'border-box', fontFamily:'-apple-system, sans-serif',
                  }}
                />
              </div>

              {/* Goal link */}
              {!isIncome && goals.filter(g => g.status === 'active').length > 0 && (
                <div>
                  <p style={{ color:MUTED, fontSize:'9px', letterSpacing:'2.5px', fontWeight:700, marginBottom:'6px' }}>連結目標</p>
                  <div style={{ position:'relative' }}>
                    <select
                      value={goalId} onChange={e => setGoalId(e.target.value)}
                      style={{
                        width:'100%', appearance:'none', background:'#0C0B09', border:`1px solid ${BORDER}`,
                        borderRadius:'5px', padding:'8px 34px 8px 12px', fontSize:'13px', color:TEXT,
                        outline:'none', cursor:'pointer', boxSizing:'border-box',
                      }}
                    >
                      <option value="">不連結目標</option>
                      {goals.filter(g => g.status === 'active').map(g => (
                        <option key={g.id} value={g.id}>{g.emoji} {g.name}</option>
                      ))}
                    </select>
                    <ChevronDown size={13} color={MUTED} style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', pointerEvents:'none' }} />
                  </div>
                </div>
              )}

              {/* Impulse checkbox */}
              {!isIncome && (
                <label style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer' }}>
                  <div
                    onClick={() => setIsImpulse(p => !p)}
                    style={{
                      width:'16px', height:'16px', borderRadius:'3px', flexShrink:0,
                      border:`1.5px solid ${isImpulse ? '#E07B5A' : BORDER}`,
                      background: isImpulse ? 'rgba(224,123,90,0.15)' : 'transparent',
                      display:'flex', alignItems:'center', justifyContent:'center',
                    }}
                  >
                    {isImpulse && <span style={{ color:'#E07B5A', fontSize:'10px', fontWeight:700 }}>✓</span>}
                  </div>
                  <span style={{ color:MUTED, fontSize:'12px' }}>標記為衝動消費</span>
                </label>
              )}

              {/* Alerts */}
              {spendingAlert && (
                <div style={{ display:'flex', gap:'8px', background:'rgba(224,123,90,0.08)', border:'1px solid rgba(224,123,90,0.25)', borderRadius:'5px', padding:'10px 12px' }}>
                  <AlertTriangle size={14} color="#E07B5A" style={{ flexShrink:0, marginTop:'1px' }} />
                  <p style={{ color:'#F4A882', fontSize:'12px', lineHeight:1.5 }}>
                    此消費使目標「<strong>{spendingAlert.goalName}</strong>」延後 <strong>{spendingAlert.setbackDays} 天</strong>
                  </p>
                </div>
              )}
              {isImpulse && profile.impulseCooldownHours > 0 && (
                <div style={{ display:'flex', gap:'8px', background:'rgba(200,164,90,0.06)', border:'1px solid rgba(200,164,90,0.2)', borderRadius:'5px', padding:'10px 12px' }}>
                  <Clock size={14} color={GOLD} style={{ flexShrink:0, marginTop:'1px' }} />
                  <p style={{ color:'#D4B87A', fontSize:'12px', lineHeight:1.5 }}>
                    建議冷靜 {profile.impulseCooldownHours} 小時後再完成購買。
                  </p>
                </div>
              )}

              {/* Submit */}
              <button
                onClick={handleSubmit}
                disabled={!amount || saved}
                style={{
                  width:'100%', padding:'13px', borderRadius:'6px', border:'none', cursor:'pointer',
                  fontWeight:700, fontSize:'14px', letterSpacing:'0.5px',
                  color: saved ? '#0C0B09' : '#0C0B09',
                  background: saved
                    ? 'linear-gradient(90deg, #52B788, #3D9B72)'
                    : 'linear-gradient(90deg, #C8A45A, #A88340)',
                  opacity: (!amount && !saved) ? 0.4 : 1,
                  transition:'opacity 0.15s',
                }}
              >
                {saved ? '✓ 已儲存！' : '儲存交易'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
