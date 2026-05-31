'use client'

import { useState, useMemo } from 'react'
import { useApp } from '@/lib/store'
import { TX_CATEGORIES } from '@/lib/constants'
import { Trash2, ArrowUpRight, ArrowDownRight, Search, MessageSquare, Check } from 'lucide-react'
import { format } from 'date-fns'

const CAT_EN: Record<string, string> = {
  salary:'薪資', investment_income:'投資收益', bonus:'獎金',
  food:'餐飲', transport:'交通', entertainment:'娛樂',
  shopping:'購物', health:'醫療', utilities:'帳單',
  goal_deposit:'目標存款', impulse:'衝動消費', other_expense:'其他',
}

const GOLD   = '#C8A45A'
const CARD   = '#161612'
const BORDER = '#2C2920'
const TEXT   = '#F0EDE6'
const MUTED  = '#6B6456'
const SERIF  = "Georgia, 'Times New Roman', serif"

type Filter = 'all' | 'income' | 'expense'

export default function TransactionsPage() {
  const { state, actions } = useApp()
  const [filter, setFilter]   = useState<Filter>('all')
  const [search, setSearch]   = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [editingId, setEditingId]   = useState<string | null>(null)
  const [draftComment, setDraftComment] = useState('')

  const displayed = useMemo(() => state.transactions.filter(t => {
    if (filter === 'income'  && !t.isIncome) return false
    if (filter === 'expense' && t.isIncome)  return false
    const q = search.toLowerCase()
    if (q && !((t.note||'').toLowerCase().includes(q) || (CAT_EN[t.category]||'').toLowerCase().includes(q))) return false
    return true
  }), [state.transactions, filter, search])

  const totalShown   = displayed.reduce((s, t) => s + (t.isIncome ? t.amount : -t.amount), 0)

  function handleRowClick(id: string) {
    setExpandedId(prev => prev === id ? null : id)
    setEditingId(null)
  }

  function startEdit(tx: typeof state.transactions[0]) {
    setEditingId(tx.id)
    setDraftComment(tx.comment || '')
  }

  function saveComment(id: string) {
    actions.updateTransactionComment(id, draftComment)
    setEditingId(null)
  }

  return (
    <div style={{ padding:'28px 32px 40px' }}>

      {/* Header */}
      <div style={{ marginBottom:'20px' }}>
        <p style={{ color:MUTED, fontSize:'10px', letterSpacing:'3px', marginBottom:'4px' }}>財務</p>
        <h1 style={{ color:TEXT, fontSize:'22px', fontWeight:300 }}>
          交易 <span style={{ color:GOLD, fontWeight:600 }}>紀錄</span>
        </h1>
      </div>

      {/* Gold divider */}
      <div style={{ height:'1px', background:`linear-gradient(90deg, rgba(200,164,90,0.3), transparent 60%)`, marginBottom:'20px' }} />

      {/* Controls */}
      <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
        {/* Filter pills */}
        <div style={{ display:'flex', background:CARD, border:`1px solid ${BORDER}`, borderRadius:'6px', overflow:'hidden' }}>
          {([
            { key: 'all',     label: '全部' },
            { key: 'income',  label: '收入' },
            { key: 'expense', label: '支出' },
          ] as { key: Filter; label: string }[]).map(({ key: f, label }) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              style={{
                padding:'7px 16px', fontSize:'12px', fontWeight:600, border:'none', cursor:'pointer',
                letterSpacing:'0.5px',
                background: filter === f ? 'rgba(200,164,90,0.1)' : 'transparent',
                color: filter === f ? GOLD : MUTED,
                borderBottom: filter === f ? `2px solid ${GOLD}` : '2px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ flex:1, display:'flex', alignItems:'center', gap:'8px', background:CARD, border:`1px solid ${BORDER}`, borderRadius:'6px', padding:'0 12px' }}>
          <Search size={13} color={MUTED} />
          <input
            type="text" placeholder="搜尋類別或備註…" value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ flex:1, background:'transparent', border:'none', outline:'none', color:TEXT, fontSize:'13px', padding:'8px 0' }}
          />
        </div>

        {/* Net */}
        <div style={{ textAlign:'right' }}>
          <p style={{ color:MUTED, fontSize:'9px', letterSpacing:'2px' }}>淨額</p>
          <p style={{ fontFamily:SERIF, fontSize:'16px', color: totalShown >= 0 ? '#52B788' : '#E07B5A' }}>
            {totalShown >= 0 ? '+' : ''}{totalShown.toLocaleString('en-US', { style:'currency', currency:'USD' })}
          </p>
        </div>
      </div>

      {/* List */}
      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
        {displayed.length === 0 && (
          <div style={{ padding:'60px 0', textAlign:'center', color:MUTED, fontSize:'13px' }}>
            找不到交易紀錄
          </div>
        )}
        {displayed.map((tx, i) => {
          const isExpanded = expandedId === tx.id
          const isEditing  = editingId === tx.id
          return (
            <div key={tx.id}>
              {/* Main row */}
              <div
                onClick={() => handleRowClick(tx.id)}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'14px 18px', background:CARD, border:`1px solid ${BORDER}`,
                  borderRadius: isExpanded ? '6px 6px 0 0' : '6px',
                  animation:`fadeUp 0.3s ${Math.min(i,10) * 0.03}s ease both`,
                  transition:'border-color 0.15s',
                  cursor:'pointer',
                  borderBottom: isExpanded ? 'none' : `1px solid ${BORDER}`,
                }}
                onMouseEnter={e => (e.currentTarget.style.borderColor = 'rgba(200,164,90,0.25)')}
                onMouseLeave={e => (e.currentTarget.style.borderColor = isExpanded ? BORDER : BORDER)}
              >
                {/* Icon + info */}
                <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{
                    width:'36px', height:'36px', borderRadius:'6px', flexShrink:0,
                    background: tx.isIncome ? 'rgba(82,183,136,0.1)' : 'rgba(224,123,90,0.1)',
                    display:'flex', alignItems:'center', justifyContent:'center',
                  }}>
                    {tx.isIncome
                      ? <ArrowUpRight size={16} color="#52B788" />
                      : <ArrowDownRight size={16} color="#E07B5A" />
                    }
                  </div>
                  <div>
                    <p style={{ color:TEXT, fontSize:'13px', fontWeight:500 }}>
                      {tx.note || CAT_EN[tx.category] || tx.category}
                    </p>
                    <p style={{ color:MUTED, fontSize:'11px', marginTop:'2px' }}>
                      {CAT_EN[tx.category]||tx.category}
                      <span style={{ margin:'0 6px', opacity:0.4 }}>·</span>
                      {new Date(tx.timestampMs).toLocaleDateString('zh-TW', { year:'numeric', month:'2-digit', day:'2-digit' })} {format(new Date(tx.timestampMs), 'HH:mm')}
                      {tx.comment && (
                        <span style={{ marginLeft:'6px', color:'rgba(200,164,90,0.6)', fontSize:'10px' }}>
                          <MessageSquare size={9} style={{ display:'inline', verticalAlign:'middle', marginRight:'2px' }} />
                          有註釋
                        </span>
                      )}
                    </p>
                  </div>
                </div>

                {/* Amount + delete */}
                <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                  <p style={{ fontFamily:SERIF, fontSize:'16px', color: tx.isIncome ? '#52B788' : '#E07B5A', letterSpacing:'-0.3px' }}>
                    {tx.isIncome ? '+' : '−'}${tx.amount.toLocaleString('en-US', { minimumFractionDigits:2 })}
                  </p>
                  <button
                    onClick={e => { e.stopPropagation(); actions.deleteTransaction(tx.id) }}
                    style={{ background:'none', border:'none', cursor:'pointer', color:BORDER, display:'flex', transition:'color 0.15s' }}
                    onMouseEnter={e => (e.currentTarget.style.color = '#E07B5A')}
                    onMouseLeave={e => (e.currentTarget.style.color = BORDER)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* 展開：註釋區 */}
              {isExpanded && (
                <div
                  style={{
                    background:'#1A1915', border:`1px solid ${BORDER}`, borderTop:'none',
                    borderRadius:'0 0 6px 6px', padding:'14px 18px',
                    animation:'fadeUp 0.18s ease both',
                  }}
                  onClick={e => e.stopPropagation()}
                >
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'8px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <MessageSquare size={12} color={GOLD} />
                      <span style={{ color:GOLD, fontSize:'11px', fontWeight:600, letterSpacing:'1px' }}>註釋</span>
                    </div>
                    {!isEditing && (
                      <button
                        onClick={() => startEdit(tx)}
                        style={{
                          background:'rgba(200,164,90,0.08)', border:`1px solid rgba(200,164,90,0.3)`,
                          borderRadius:'4px', padding:'3px 10px', color:GOLD,
                          fontSize:'11px', cursor:'pointer',
                        }}
                      >
                        {tx.comment ? '修改' : '新增註釋'}
                      </button>
                    )}
                  </div>

                  {isEditing ? (
                    <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
                      <textarea
                        value={draftComment}
                        onChange={e => setDraftComment(e.target.value)}
                        placeholder="輸入你的註釋…"
                        autoFocus
                        rows={2}
                        style={{
                          flex:1, background:'rgba(255,255,255,0.04)', border:`1px solid rgba(200,164,90,0.3)`,
                          borderRadius:'5px', padding:'8px 10px', color:TEXT, fontSize:'12px',
                          outline:'none', resize:'none', fontFamily:'inherit',
                        }}
                      />
                      <div style={{ display:'flex', flexDirection:'column', gap:'4px' }}>
                        <button
                          onClick={() => saveComment(tx.id)}
                          style={{
                            background:'rgba(82,183,136,0.15)', border:'1px solid rgba(82,183,136,0.4)',
                            borderRadius:'4px', padding:'6px 10px', color:'#52B788',
                            fontSize:'11px', cursor:'pointer', display:'flex', alignItems:'center', gap:'4px',
                          }}
                        >
                          <Check size={11} /> 儲存
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          style={{
                            background:'transparent', border:`1px solid ${BORDER}`,
                            borderRadius:'4px', padding:'6px 10px', color:MUTED,
                            fontSize:'11px', cursor:'pointer',
                          }}
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <p style={{ color: tx.comment ? TEXT : MUTED, fontSize:'12px', lineHeight:'1.6', fontStyle: tx.comment ? 'normal' : 'italic' }}>
                      {tx.comment || '尚無註釋，點擊「新增註釋」來記錄更多資訊'}
                    </p>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
