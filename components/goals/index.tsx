'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus, X, Trash2, TrendingUp, AlertCircle, ChevronDown } from 'lucide-react'
import { useApp } from '@/lib/store'
import { financeService } from '@/lib/api'
import { GOAL_CATEGORIES, GOAL_COLORS, GOAL_EMOJIS } from '@/lib/constants'
import type { Goal, GoalCategory, RiskLevel } from '@/types'

function fmt(n: number) {
  return n.toLocaleString('zh-TW')
}

// 分配條目顏色
const ALLOC_COLORS = {
  living:    '#52B788',
  savings:   '#C8A45A',
  emergency: '#4AABB8',
  invest:    '#8b5cf6',
}

export function GoalsPage() {
  const { state, actions } = useApp()
  const { goals, profile } = state
  const [createOpen, setCreateOpen] = useState(false)

  const gap = useMemo(
    () => financeService.getGapAnalysis(profile.monthlyIncome, goals),
    [profile.monthlyIncome, goals],
  )

  const activeGoals    = goals.filter(g => g.status === 'active')
  const completedGoals = goals.filter(g => g.status === 'completed')

  return (
    <div className="flex flex-col min-h-screen bg-[#f0fdf4]">
      {/* Gap Analysis Panel */}
      <div className="dark-panel relative overflow-hidden px-5 pt-10 pb-6 rounded-b-3xl scan-line">
        <div className="grid-overlay absolute inset-0 pointer-events-none opacity-50" />
        <div className="relative z-10">
          <div className="flex items-center justify-between mb-1">
            <p className="text-green-600/70 text-xs font-semibold tracking-widest uppercase">Gap Analysis</p>
            {/* 目標上限 1 個 */}
            {activeGoals.length >= 1 ? (
              <span className="text-xs text-amber-400 font-mono border border-amber-700/40 bg-amber-900/20 px-2.5 py-1 rounded-full">
                已達上限 1/1
              </span>
            ) : (
              <button
                onClick={() => setCreateOpen(true)}
                className="flex items-center gap-1 bg-green-500/20 border border-green-500/40 text-green-400 text-xs font-semibold px-3 py-1.5 rounded-full hover:bg-green-500/30 transition-colors"
              >
                <Plus size={12} /> 新增 ({activeGoals.length}/1)
              </button>
            )}
          </div>

          <div className="flex gap-6 mt-3">
            <div>
              <p className="text-green-600/60 text-[10px]">月收入</p>
              <p className="font-mono text-lg text-green-300 font-bold">NT$ {fmt(gap.monthlyIncome)}</p>
            </div>
            <div className="flex items-center">
              <TrendingUp size={14} className={gap.isDeficit ? 'text-red-400' : 'text-green-400'} />
            </div>
            <div>
              <p className="text-green-600/60 text-[10px]">月需求</p>
              <p className="font-mono text-lg text-green-300 font-bold">NT$ {fmt(gap.totalMonthlyNeed)}</p>
            </div>
          </div>

          <div className={`mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold font-mono ${
            gap.isDeficit
              ? 'bg-red-500/20 text-red-400 border border-red-500/30'
              : 'bg-green-500/20 text-green-400 border border-green-500/30'
          }`}>
            {gap.isDeficit ? '⚠️ 赤字' : '✅ 盈餘'}{' '}
            NT$ {fmt(Math.abs(gap.surplus))}
          </div>

          {gap.isDeficit && gap.recommendations.length > 0 && (
            <div className="mt-3 flex flex-col gap-1.5">
              <p className="text-[10px] text-green-600/60 font-semibold">建議削減</p>
              {gap.recommendations.map(r => (
                <div key={r.goalId} className="flex items-center justify-between bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-1.5">
                  <span className="text-xs text-red-300">{r.name}</span>
                  <span className="text-xs font-mono text-red-400">-NT$ {fmt(r.suggestedCut)}/月</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="px-4 mt-4 flex flex-col gap-4 pb-6">
        {/* 進行中目標 */}
        {activeGoals.length === 0 ? (
          <motion.button
            onClick={() => setCreateOpen(true)}
            whileTap={{ scale: 0.98 }}
            className="w-full rounded-2xl border-2 border-dashed border-green-300 py-10 flex flex-col items-center gap-2 text-green-500 hover:border-green-400 transition-colors mt-2"
          >
            <span className="text-4xl">🎯</span>
            <span className="text-sm font-medium">設定你的財務目標</span>
            <span className="text-xs text-green-400/70">點擊開始</span>
          </motion.button>
        ) : (
          <>
            <div className="flex items-center justify-between">
              <h2 className="font-bold text-green-900">進行中 ({activeGoals.length})</h2>
            </div>
            <div className="flex flex-col gap-3">
              {activeGoals.map((g, i) => (
                <GoalCard
                  key={g.id} goal={g} index={i}
                  onDelete={() => actions.deleteGoal(g.id)}
                  monthlyIncome={profile.monthlyIncome}
                />
              ))}
            </div>
          </>
        )}

        {/* 已完成目標 */}
        {completedGoals.length > 0 && (
          <>
            <h2 className="font-bold text-green-900 mt-2">已完成 ({completedGoals.length})</h2>
            <div className="flex flex-col gap-3">
              {completedGoals.map((g, i) => (
                <GoalCard
                  key={g.id} goal={g} index={i}
                  onDelete={() => actions.deleteGoal(g.id)}
                  monthlyIncome={profile.monthlyIncome}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <CreateGoalModal open={createOpen} onClose={() => setCreateOpen(false)} />
    </div>
  )
}

// ── GoalCard ─────────────────────────────────────────────────────

function GoalCard({
  goal, index, onDelete, monthlyIncome,
}: {
  goal: Goal; index: number; onDelete: () => void; monthlyIncome: number
}) {
  const [showDelete, setShowDelete]   = useState(false)
  const [showBreakdown, setShowBreakdown] = useState(false)

  const alloc = useMemo(
    () => financeService.calcAllocation(goal, monthlyIncome),
    [goal, monthlyIncome],
  )

  const allocItems = [
    { label: '生活費',   pct: alloc.livingPct,    color: ALLOC_COLORS.living },
    { label: '目標儲蓄', pct: alloc.savingsPct,   color: ALLOC_COLORS.savings },
    { label: '緊急備用', pct: alloc.emergencyPct, color: ALLOC_COLORS.emergency },
    { label: '投資理財', pct: alloc.investmentPct,color: ALLOC_COLORS.invest },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="glass-card rounded-2xl overflow-hidden"
    >
      <div className="h-1" style={{ background: goal.color }} />
      <div className="p-4">
        {/* 頂部 */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xl">{goal.emoji}</span>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-sm font-bold text-green-900">{goal.name}</p>
                {goal.status === 'completed' && (
                  <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-semibold">✅ 完成</span>
                )}
              </div>
              <p className="text-[10px] text-green-600/70">
                {GOAL_CATEGORIES[goal.category]?.label} · {goal.daysLeft > 0 ? `${goal.daysLeft} 天後到期` : '已到期'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* 展開分配 */}
            <button
              onClick={() => setShowBreakdown(p => !p)}
              className="text-green-600/50 hover:text-green-600 transition-colors"
            >
              <ChevronDown size={14} className={`transition-transform ${showBreakdown ? 'rotate-180' : ''}`} />
            </button>
            <button
              onClick={() => setShowDelete(p => !p)}
              className="text-green-700/40 hover:text-red-400 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        {/* 進度條 */}
        <div className="h-2 rounded-full bg-green-100 overflow-hidden mb-2">
          <motion.div
            className="h-full rounded-full"
            style={{ background: `linear-gradient(90deg, ${goal.color}99, ${goal.color})`, boxShadow: `0 0 8px ${goal.color}55` }}
            initial={{ width: 0 }}
            animate={{ width: `${goal.progressPct}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono">
          <span className="text-green-700">NT$ {fmt(goal.currentAmount)}</span>
          <span className="font-bold" style={{ color: goal.color }}>{goal.progressPct}%</span>
          <span className="text-green-500/70">/ NT$ {fmt(goal.targetAmount)}</span>
        </div>

        {goal.monthlyGap > 0 && (
          <div className="mt-2 flex items-center gap-1.5 text-[10px] text-green-600/70">
            <AlertCircle size={10} />
            <span>每月需存 NT$ {fmt(goal.monthlyGap)}</span>
          </div>
        )}

        {/* ── 分配明細展開 ── */}
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-green-100 flex flex-col gap-2.5">
                <p className="text-[10px] text-green-600/60 font-semibold mb-0.5">智慧分配建議（基於剩餘時間自動調整）</p>
                {allocItems.map(item => (
                  <div key={item.label}>
                    <div className="flex justify-between text-[11px] mb-1">
                      <span className="text-green-800 font-medium">{item.label}</span>
                      <span className="font-mono font-bold" style={{ color: item.color }}>{item.pct}%</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-green-100 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: item.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${item.pct}%` }}
                        transition={{ duration: 0.6 }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 刪除確認 */}
        <AnimatePresence>
          {showDelete && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-green-100">
                <button
                  onClick={onDelete}
                  className="flex-1 py-2 rounded-xl bg-red-500/10 border border-red-500/30 text-red-500 text-xs font-semibold flex items-center justify-center gap-1"
                >
                  <Trash2 size={12} /> 刪除目標
                </button>
                <button
                  onClick={() => setShowDelete(false)}
                  className="flex-1 py-2 rounded-xl bg-green-100 text-green-700 text-xs font-semibold"
                >
                  取消
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// ── CreateGoalModal ────────────────────────────────────────────────

function CreateGoalModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { actions } = useApp()

  const [name, setName]           = useState('')
  const [emoji, setEmoji]         = useState('🎯')
  const [color, setColor]         = useState('#22c55e')
  const [target, setTarget]       = useState('')
  const [deadline, setDeadline]   = useState('')
  const [category, setCategory]   = useState<GoalCategory>('savings')
  const [riskLevel, setRiskLevel] = useState<RiskLevel>(2)
  const [saving, setSaving]       = useState(false)

  function reset() {
    setName(''); setEmoji('🎯'); setColor('#22c55e')
    setTarget(''); setDeadline(''); setCategory('savings'); setRiskLevel(2); setSaving(false)
  }

  function handleClose() { reset(); onClose() }

  function handleCreate() {
    if (!name || !target || !deadline) return
    setSaving(true)
    const deadlineMs = new Date(deadline).getTime()
    actions.createGoal({
      name, emoji, color,
      targetAmount: Number(target),
      currentAmount: 0,
      deadlineMs,
      category,
      status: 'active',
      riskLevel,
      coolingOffUntilMs: 0,
    })
    setTimeout(() => { handleClose() }, 400)
  }

  const canCreate = !!name && !!target && !!deadline && Number(target) > 0

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={handleClose}
          />
          <motion.div
            className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md z-50 rounded-t-3xl overflow-hidden"
            style={{ background: '#071a0c', border: '1px solid rgba(34,197,94,0.2)' }}
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-green-800" />
            </div>

            <div className="px-5 pb-10 flex flex-col gap-4 max-h-[88vh] overflow-y-auto">
              <div className="flex items-center justify-between">
                <h3 className="text-base font-bold text-green-300">建立新目標</h3>
                <button onClick={handleClose} className="text-green-600 hover:text-green-400">
                  <X size={20} />
                </button>
              </div>

              {/* Emoji picker */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">選擇表情</p>
                <div className="grid grid-cols-8 gap-1.5">
                  {GOAL_EMOJIS.map(e => (
                    <button
                      key={e}
                      onClick={() => setEmoji(e)}
                      className={`text-xl p-1.5 rounded-lg transition-all ${
                        emoji === e ? 'bg-green-500/30 ring-1 ring-green-500' : 'hover:bg-white/10'
                      }`}
                    >
                      {e}
                    </button>
                  ))}
                </div>
              </div>

              {/* Name */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">目標名稱</p>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="例如：去日本旅遊"
                  className="w-full bg-white/5 border border-green-900 rounded-xl px-3 py-2.5 text-sm text-green-300 outline-none placeholder:text-green-800 focus:border-green-600 transition-colors"
                />
              </div>

              {/* Target amount */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">目標金額 (NT$)</p>
                <div className="flex items-center gap-2 bg-white/5 border border-green-900 rounded-xl px-3 py-2.5 focus-within:border-green-600 transition-colors">
                  <span className="text-green-600 font-mono text-sm">NT$</span>
                  <input
                    type="number"
                    value={target}
                    onChange={e => setTarget(e.target.value)}
                    placeholder="0"
                    className="flex-1 bg-transparent font-mono text-lg text-green-300 outline-none w-0"
                  />
                </div>
              </div>

              {/* Deadline */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">截止日期</p>
                <input
                  type="date"
                  value={deadline}
                  onChange={e => setDeadline(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full bg-white/5 border border-green-900 rounded-xl px-3 py-2.5 text-sm text-green-300 outline-none focus:border-green-600 transition-colors [color-scheme:dark]"
                />
              </div>

              {/* Category */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">分類</p>
                <div className="grid grid-cols-3 gap-2">
                  {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                    <button
                      key={k}
                      onClick={() => setCategory(k as GoalCategory)}
                      className={`rounded-xl py-2 px-2 text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                        category === k
                          ? 'bg-green-500/20 border-green-500 text-green-400'
                          : 'bg-white/5 border-green-900 text-green-600 hover:border-green-700'
                      }`}
                    >
                      <span>{v.emoji}</span> {v.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color */}
              <div>
                <p className="text-xs text-green-600 mb-2 font-semibold">顏色</p>
                <div className="flex gap-2 flex-wrap">
                  {GOAL_COLORS.map(c => (
                    <button
                      key={c}
                      onClick={() => setColor(c)}
                      style={{ background: c, ...(color === c ? { outline: `2px solid ${c}`, outlineOffset: 2 } : {}) } as React.CSSProperties}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        color === c ? 'scale-110' : 'hover:scale-110'
                      }`}
                    />
                  ))}
                </div>
              </div>

              <motion.button
                onClick={handleCreate}
                disabled={!canCreate || saving}
                whileTap={{ scale: 0.97 }}
                className="w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold text-base glow-green disabled:opacity-40 transition-all mt-2"
              >
                {saving ? '建立中...' : '建立目標 🎯'}
              </motion.button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
