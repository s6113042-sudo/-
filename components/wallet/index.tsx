'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Wallet, Copy, ExternalLink, Zap, Plus, RefreshCw,
  LogOut, Radio, X, Trash2, RepeatIcon, CalendarDays,
} from 'lucide-react'
import { format, differenceInDays, parseISO } from 'date-fns'
import { useApp } from '@/lib/store'
import { TX_CATEGORIES, GOAL_EMOJIS } from '@/lib/constants'
import { AddTransactionModal } from '@/components/shared/add-transaction-modal'
import type { TxCategory, RecurringFrequency } from '@/types'

const MOCK_ADDRESS = '0x7a3f9b2c1d8e5f4a6b0c9d2e1f3a7b4c8d0e5f2a'
const MOCK_BALANCE = 12.847

function shortAddr(addr: string) { return `${addr.slice(0, 8)}...${addr.slice(-6)}` }
function fmt(n: number) { return n.toLocaleString('zh-TW') }

// ─── 新增固定支出 Modal ──────────────────────

const EXPENSE_CATS = Object.entries(TX_CATEGORIES)
  .filter(([, v]) => !v.isIncome)
  .map(([k, v]) => ({ key: k as TxCategory, ...v }))

function AddRecurringModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useApp()
  const [name, setName]         = useState('')
  const [emoji, setEmoji]       = useState('💳')
  const [amount, setAmount]     = useState('')
  const [category, setCategory] = useState<TxCategory>('utilities')
  const [freq, setFreq]         = useState<RecurringFrequency>('monthly')
  const [dayOf, setDayOf]       = useState(1)
  const [notes, setNotes]       = useState('')

  function reset() {
    setName(''); setEmoji('💳'); setAmount(''); setCategory('utilities')
    setFreq('monthly'); setDayOf(1); setNotes('')
  }

  function handleSubmit() {
    if (!name.trim() || !amount || Number(amount) <= 0) return
    actions.addRecurring({
      name: name.trim(), emoji, amount: Number(amount),
      category, frequency: freq, dayOf, isActive: true, notes: notes.trim(),
    })
    reset(); onClose()
  }

  const inputCls = "w-full bg-white/5 border border-green-900 rounded-xl px-3 py-2 text-sm text-green-300 outline-none focus:border-green-600 transition-colors"

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={() => { reset(); onClose() }} />
          <motion.div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 rounded-t-3xl overflow-hidden"
            style={{ background: '#071a0c', border: '1px solid rgba(34,197,94,0.2)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-green-800" />
            </div>
            <div className="px-5 pb-8 flex flex-col gap-4 max-h-[85vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-green-300">新增固定支出</h3>
                <button onClick={() => { reset(); onClose() }} className="text-green-600"><X size={20} /></button>
              </div>

              {/* emoji picker (small) */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">圖示</p>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_EMOJIS.slice(0, 12).concat(['💳','📡','🏠','📱','💡','🚰']).map(e => (
                    <button key={e} onClick={() => setEmoji(e)}
                      className={`w-9 h-9 rounded-lg text-lg flex items-center justify-center transition-all ${
                        emoji === e ? 'bg-green-500/30 ring-1 ring-green-500' : 'bg-white/5 hover:bg-white/10'
                      }`}>{e}</button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-green-600 mb-1 font-semibold">名稱</p>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="例如：手機月租" className={inputCls} />
              </div>

              <div>
                <p className="text-xs text-green-600 mb-1 font-semibold">金額（NT$）</p>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value)} placeholder="599" className={`${inputCls} font-mono`} min="1" />
              </div>

              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">分類</p>
                <div className="grid grid-cols-4 gap-1.5">
                  {EXPENSE_CATS.slice(0, 8).map(c => (
                    <button key={c.key} onClick={() => setCategory(c.key)}
                      style={{ borderColor: category === c.key ? c.color : 'transparent' }}
                      className={`rounded-xl py-2 px-1 border flex flex-col items-center gap-0.5 ${
                        category === c.key ? 'bg-white/10' : 'bg-white/5'
                      }`}>
                      <span className="text-base">{c.emoji}</span>
                      <span className="text-[9px] text-green-400 leading-tight text-center">{c.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* frequency */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">頻率</p>
                <div className="flex gap-2">
                  {(['monthly', 'weekly'] as const).map(f => (
                    <button key={f} onClick={() => setFreq(f)}
                      className={`flex-1 py-2 rounded-xl text-sm font-semibold border transition-colors ${
                        freq === f
                          ? 'bg-green-500/20 text-green-400 border-green-500/50'
                          : 'text-green-700 border-green-900 hover:text-green-500'
                      }`}>
                      {f === 'monthly' ? '每月' : '每週'}
                    </button>
                  ))}
                </div>

                <div className="mt-2">
                  <p className="text-xs text-green-600 mb-1 font-semibold">
                    {freq === 'monthly' ? '每月第幾日（1-28）' : '每週幾（0=日 6=六）'}
                  </p>
                  <input type="number" value={dayOf}
                    onChange={e => setDayOf(Math.max(0, Math.min(freq === 'monthly' ? 28 : 6, Number(e.target.value))))}
                    min={0} max={freq === 'monthly' ? 28 : 6}
                    className={`${inputCls} font-mono`} />
                </div>
              </div>

              <div>
                <p className="text-xs text-green-600 mb-1 font-semibold">備註（選填）</p>
                <input value={notes} onChange={e => setNotes(e.target.value)} placeholder="備註..." className={inputCls} />
              </div>

              <motion.button onClick={handleSubmit} disabled={!name.trim() || !amount}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-2xl font-bold text-white bg-green-500 glow-green disabled:opacity-40">
                新增固定支出
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}

// ─── Main WalletPage ──────────────────────────

export function WalletPage() {
  const { state, actions, dispatch } = useApp()
  const { wallet, transactions, recurringExpenses } = state

  const [connecting, setConnecting]     = useState(false)
  const [initializing, setInitializing] = useState(false)
  const [copied, setCopied]             = useState(false)
  const [txModalOpen, setTxModalOpen]   = useState(false)
  const [recModalOpen, setRecModalOpen] = useState(false)
  const [toast, setToast]               = useState<string | null>(null)

  function showToast(msg: string) { setToast(msg); setTimeout(() => setToast(null), 2500) }

  async function handleConnect() {
    setConnecting(true)
    await new Promise(r => setTimeout(r, 1200))
    actions.connectWallet(MOCK_ADDRESS)
    dispatch({ type: 'SET_WALLET', payload: { suiBalance: MOCK_BALANCE } })
    setConnecting(false)
    showToast('✅ 錢包已連接')
  }

  function handleDisconnect() { actions.disconnectWallet(); showToast('錢包已中斷連接') }

  async function handleInitialize() {
    if (!wallet.isConnected || wallet.isInitialized) return
    setInitializing(true)
    await new Promise(r => setTimeout(r, 1500))
    dispatch({ type: 'SET_WALLET', payload: { isInitialized: true } })
    setInitializing(false)
    showToast('✅ 鏈上帳戶初始化成功')
  }

  async function handleCopy() {
    if (!wallet.address) return
    await navigator.clipboard.writeText(wallet.address)
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  // Feature 1: 模擬收付款
  function simulateIncome() {
    const amt = Math.floor(Math.random() * 3000) + 1000
    actions.simulateWalletIncome(amt)
    showToast(`📥 模擬收款 NT$ ${amt.toLocaleString()}`)
  }
  function simulateExpense() {
    const amt = Math.floor(Math.random() * 300) + 50
    actions.simulateWalletExpense(amt)
    showToast(`📤 模擬付款 NT$ ${amt.toLocaleString()}`)
  }

  const recentTxs = transactions.slice(0, 10)

  // Feature 2: 固定支出統計
  const recurringMonthlyTotal = useMemo(
    () => recurringExpenses
      .filter(r => r.isActive)
      .reduce((s, r) => s + (r.frequency === 'monthly' ? r.amount : r.amount * 4.33), 0),
    [recurringExpenses]
  )

  const DOW_LABELS = ['日','一','二','三','四','五','六']

  return (
    <div className="flex flex-col min-h-screen bg-[#f0fdf4] pb-6">
      {/* Hero dark panel */}
      <div className="dark-panel scan-line relative overflow-hidden px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="grid-overlay absolute inset-0 pointer-events-none opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <Wallet size={18} className="text-green-400" />
            <p className="text-green-300 font-bold">Sui 錢包</p>
          </div>

          {!wallet.isConnected ? (
            <motion.button onClick={handleConnect} disabled={connecting} whileTap={{ scale: 0.97 }}
              className="w-full py-4 rounded-2xl bg-green-500/20 border-2 border-green-500/50 text-green-400 font-bold text-base glow-green disabled:opacity-60 flex items-center justify-center gap-2 pulse-ring">
              {connecting ? <><RefreshCw size={18} className="animate-spin" /> 連接中...</>
                : <><Wallet size={20} /> 連接 Sui 錢包</>}
            </motion.button>
          ) : (
            <div className="flex flex-col gap-3">
              {/* Address */}
              <div className="flex items-center gap-2 bg-green-900/30 rounded-xl px-3 py-2.5">
                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                <span className="font-mono text-sm text-green-300 flex-1 truncate">{shortAddr(wallet.address!)}</span>
                <button onClick={handleCopy} className="text-green-600 hover:text-green-400">
                  {copied ? <span className="text-xs text-green-400">✓</span> : <Copy size={14} />}
                </button>
                <button className="text-green-600 hover:text-green-400"><ExternalLink size={14} /></button>
              </div>

              {/* Balance */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-600/60 text-xs">SUI 餘額</p>
                  <p className="font-mono text-2xl font-bold neon-text">{MOCK_BALANCE} SUI</p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs bg-blue-500/20 text-blue-400 border border-blue-500/30 px-2 py-0.5 rounded-full font-semibold">
                    {wallet.network}
                  </span>
                  <button onClick={handleDisconnect}
                    className="flex items-center gap-1 text-xs text-green-700 hover:text-red-400 transition-colors">
                    <LogOut size={11} /> 中斷
                  </button>
                </div>
              </div>

              {/* Init */}
              {!wallet.isInitialized ? (
                <motion.button onClick={handleInitialize} disabled={initializing} whileTap={{ scale: 0.97 }}
                  className="w-full py-2.5 rounded-xl bg-green-500/20 border border-green-500/40 text-green-400 text-sm font-semibold flex items-center justify-center gap-2 hover:bg-green-500/30 disabled:opacity-50">
                  {initializing ? <><RefreshCw size={14} className="animate-spin" /> 初始化中...</>
                    : <><Zap size={14} /> 鏈上初始化</>}
                </motion.button>
              ) : (
                <div className="flex items-center gap-1.5 text-xs text-green-500/70">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-400" />已完成鏈上初始化
                </div>
              )}

              {/* Feature 1: 自動同步 */}
              <div className="flex flex-col gap-2 bg-green-900/20 rounded-xl p-3 border border-green-900">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Radio size={14} className={wallet.syncEnabled ? 'text-green-400 animate-pulse' : 'text-green-700'} />
                    <span className="text-xs font-semibold text-green-400">自動同步交易</span>
                    {wallet.syncEnabled && (
                      <span className="text-[10px] text-green-500/70 font-mono">每 30 秒</span>
                    )}
                  </div>
                  <button onClick={actions.toggleWalletSync}
                    className={`w-10 h-5 rounded-full transition-colors relative ${wallet.syncEnabled ? 'bg-green-500' : 'bg-green-900'}`}>
                    <motion.div
                      animate={{ x: wallet.syncEnabled ? 20 : 2 }}
                      transition={{ type: 'spring', stiffness: 500, damping: 30 }}
                      className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow"
                    />
                  </button>
                </div>
                {/* Mock buttons */}
                <div className="flex gap-2">
                  <button onClick={simulateIncome}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-green-400 bg-green-500/15 border border-green-700 hover:bg-green-500/25 transition-colors">
                    📥 模擬收款
                  </button>
                  <button onClick={simulateExpense}
                    className="flex-1 py-1.5 rounded-lg text-xs font-semibold text-red-400 bg-red-500/10 border border-red-800/40 hover:bg-red-500/20 transition-colors">
                    📤 模擬付款
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-4 flex flex-col gap-4">
        {/* Quick add */}
        <button onClick={() => setTxModalOpen(true)}
          className="w-full glass-card rounded-2xl py-3.5 flex items-center justify-center gap-2 text-green-600 font-semibold text-sm hover:bg-green-50 transition-colors border-2 border-dashed border-green-300">
          <Plus size={16} /> 快速新增交易
        </button>

        {/* Feature 2: 固定支出 */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <RepeatIcon size={16} className="text-green-600" />
              <h3 className="font-bold text-green-900 text-sm">固定支出</h3>
            </div>
            <div className="flex items-center gap-2">
              {recurringExpenses.length > 0 && (
                <span className="text-xs font-mono text-green-600/70">
                  NT$ {Math.round(recurringMonthlyTotal).toLocaleString()}/月
                </span>
              )}
              <button onClick={() => setRecModalOpen(true)}
                className="flex items-center gap-1 text-xs text-green-500 font-semibold">
                <Plus size={12} /> 新增
              </button>
            </div>
          </div>

          {recurringExpenses.length === 0 ? (
            <button onClick={() => setRecModalOpen(true)}
              className="w-full rounded-2xl border-2 border-dashed border-green-200 py-6 flex flex-col items-center gap-2 text-green-500/60 hover:border-green-300 transition-colors text-sm">
              <RepeatIcon size={22} />
              <span>新增固定支出條目</span>
              <span className="text-xs text-green-500/40">房租、手機費、訂閱…</span>
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              {recurringExpenses.map((r, i) => {
                const daysLeft = differenceInDays(parseISO(r.nextDueDate), new Date())
                const isUrgent = daysLeft <= 3
                const cat      = TX_CATEGORIES[r.category]
                return (
                  <motion.div key={r.id}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="glass-card rounded-xl px-4 py-3 flex items-center gap-3"
                  >
                    <span className="text-xl shrink-0">{r.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-900 truncate">{r.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-green-600/70">
                          {r.frequency === 'monthly' ? `每月 ${r.dayOf} 日` : `每週${DOW_LABELS[r.dayOf]}`}
                        </span>
                        <span className={`text-[10px] font-semibold ${isUrgent ? 'text-red-400' : 'text-green-500/60'}`}>
                          <CalendarDays size={9} className="inline mr-0.5" />
                          {daysLeft < 0 ? '已過期' : daysLeft === 0 ? '今天到期' : `${daysLeft} 天後`}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold text-red-400">
                        NT$ {fmt(r.amount)}
                      </p>
                      <button onClick={() => actions.deleteRecurring(r.id)}
                        className="text-green-700/40 hover:text-red-400 transition-colors mt-0.5">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </motion.div>
                )
              })}
              {/* 月總計 */}
              <div className="flex justify-between items-center px-2 py-1">
                <span className="text-xs text-green-600/60">每月固定支出合計</span>
                <span className="text-sm font-mono font-bold text-red-400">
                  NT$ {Math.round(recurringMonthlyTotal).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Recent transactions */}
        <div>
          <h3 className="font-bold text-green-900 text-sm mb-3">近期交易</h3>
          {recentTxs.length === 0 ? (
            <div className="text-center py-8 text-green-500/50 text-sm">尚無交易記錄</div>
          ) : (
            <div className="flex flex-col gap-2">
              {recentTxs.map((tx, i) => {
                const cat = TX_CATEGORIES[tx.category]
                return (
                  <motion.div key={tx.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="glass-card rounded-xl px-4 py-3 flex items-center gap-3">
                    <span className="text-xl shrink-0">{cat?.emoji ?? '💰'}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-green-900 truncate">{cat?.label ?? tx.category}</p>
                      <div className="flex items-center gap-1.5">
                        <p className="text-[10px] text-green-600/70">{tx.date}</p>
                        {tx.txDigest && (
                          <span className="text-[9px] text-blue-400/70 font-mono">⛓ 鏈上</span>
                        )}
                      </div>
                    </div>
                    <span className={`font-mono text-sm font-bold shrink-0 ${tx.isIncome ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.isIncome ? '+' : '-'}NT${fmt(tx.amount)}
                    </span>
                  </motion.div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <AddTransactionModal open={txModalOpen} onClose={() => setTxModalOpen(false)} />
      <AddRecurringModal open={recModalOpen} onClose={() => setRecModalOpen(false)} />

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 dark-panel px-5 py-3 rounded-2xl text-green-300 text-sm font-semibold whitespace-nowrap glow-green">
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
