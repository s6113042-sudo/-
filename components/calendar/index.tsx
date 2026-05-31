'use client'

import { useState, useMemo, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronLeft, ChevronRight, X } from 'lucide-react'
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts'
import { txService } from '@/lib/api'
import { TX_CATEGORIES } from '@/lib/constants'
import type { DayRecord, Transaction } from '@/types'

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

type PeriodTab = 'week' | 'month' | 'quarter'

function fmt(n: number) { return n.toLocaleString('zh-TW') }

export function CalendarPage() {
  const today = new Date()
  const [year, setYear]                   = useState(today.getFullYear())
  const [month, setMonth]                 = useState(today.getMonth() + 1)
  const [selectedDate, setSelectedDate]   = useState<string | null>(null)
  const [periodTab, setPeriodTab]         = useState<PeriodTab>('month')

  const calData = useMemo(() => txService.getCalendarData(year, month), [year, month])

  const firstDay = new Date(year, month - 1, 1).getDay()
  const daysInMonth = new Date(year, month, 0).getDate()

  function prevMonth() {
    if (month === 1) { setYear(y => y - 1); setMonth(12) }
    else setMonth(m => m - 1)
    setSelectedDate(null)
  }
  function nextMonth() {
    if (month === 12) { setYear(y => y + 1); setMonth(1) }
    else setMonth(m => m + 1)
    setSelectedDate(null)
  }

  const selectedRecord: DayRecord | null = selectedDate ? calData[selectedDate] ?? null : null

  // Period breakdown
  const { from, to } = useMemo(() => {
    const now = Date.now()
    if (periodTab === 'week') {
      const d = new Date(); d.setHours(0,0,0,0)
      const day = d.getDay()
      const start = new Date(d); start.setDate(d.getDate() - day)
      const end = new Date(start); end.setDate(start.getDate() + 6); end.setHours(23,59,59,999)
      return { from: start.getTime(), to: end.getTime() }
    } else if (periodTab === 'month') {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 0, 23, 59, 59, 999)
      return { from: start.getTime(), to: end.getTime() }
    } else {
      const q = Math.floor((new Date().getMonth()) / 3)
      const start = new Date(new Date().getFullYear(), q * 3, 1)
      const end = new Date(new Date().getFullYear(), q * 3 + 3, 0, 23, 59, 59, 999)
      return { from: start.getTime(), to: end.getTime() }
    }
  }, [periodTab, year, month])

  const breakdown = useMemo(() => txService.getCategoryBreakdown(from, to), [from, to])
  const totalExpense = useMemo(() => breakdown.reduce((s, b) => s + b.amount, 0), [breakdown])

  const donutData = breakdown.slice(0, 6).map(b => ({
    name: b.label,
    value: b.amount,
    color: b.color,
  }))

  return (
    <div className="flex flex-col min-h-screen bg-[#f0fdf4] pb-6">
      {/* Header */}
      <div className="dark-panel px-5 pt-10 pb-5 rounded-b-3xl">
        <div className="flex items-center justify-between">
          <button onClick={prevMonth} className="p-2 rounded-xl text-green-400 hover:bg-green-900/30 transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="text-center">
            <p className="font-mono text-lg font-bold neon-text">{year} 年 {month} 月</p>
            <p className="text-xs text-green-600/70">財務月曆</p>
          </div>
          <button onClick={nextMonth} className="p-2 rounded-xl text-green-400 hover:bg-green-900/30 transition-colors">
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="px-4 mt-4 flex flex-col gap-4">
        {/* Weekday headers */}
        <div className="grid grid-cols-7 gap-1">
          {WEEKDAYS.map(d => (
            <div key={d} className="text-center text-[10px] font-semibold text-green-600/60 py-1">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1">
          {Array.from({ length: firstDay }).map((_, i) => <div key={`empty-${i}`} />)}
          {Array.from({ length: daysInMonth }).map((_, i) => {
            const day = i + 1
            const dateStr = `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`
            const rec = calData[dateStr]
            const isToday = dateStr === today.toISOString().slice(0, 10)
            const isSelected = selectedDate === dateStr

            return (
              <DayCell
                key={dateStr}
                day={day}
                record={rec}
                isToday={isToday}
                isSelected={isSelected}
                onClick={() => setSelectedDate(isSelected ? null : dateStr)}
              />
            )
          })}
        </div>

        {/* Day detail panel */}
        <AnimatePresence>
          {selectedRecord && (
            <motion.div
              key={selectedDate}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <DayDetail date={selectedDate!} record={selectedRecord} onClose={() => setSelectedDate(null)} />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Period Donut Chart */}
        <div className="glass-card rounded-2xl p-4 mt-2">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-bold text-green-900">支出分類</p>
            <div className="flex gap-1">
              {([['week', '本週'], ['month', '本月'], ['quarter', '本季']] as const).map(([v, label]) => (
                <button
                  key={v}
                  onClick={() => setPeriodTab(v)}
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold transition-colors ${
                    periodTab === v
                      ? 'bg-green-500/20 text-green-600 border border-green-500/40'
                      : 'text-green-600/60 hover:text-green-600'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {donutData.length === 0 ? (
            <div className="text-center py-8 text-green-500/50 text-sm">本期無支出記錄</div>
          ) : (
            <div className="flex items-center gap-4">
              <div className="relative w-32 h-32 shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutData}
                      cx="50%"
                      cy="50%"
                      innerRadius={38}
                      outerRadius={58}
                      paddingAngle={2}
                      dataKey="value"
                      stroke="none"
                    >
                      {donutData.map((entry, idx) => (
                        <Cell key={idx} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [`NT$ ${fmt(v)}`, '']}
                      contentStyle={{ background: '#071a0c', border: '1px solid rgba(34,197,94,0.2)', borderRadius: 8, fontSize: 11 }}
                      labelStyle={{ color: '#4ade80' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <p className="text-[9px] text-green-600/70 font-semibold">總支出</p>
                  <p className="font-mono text-xs font-bold text-green-800 leading-tight">
                    {totalExpense >= 10000 ? `${(totalExpense / 1000).toFixed(1)}k` : fmt(totalExpense)}
                  </p>
                </div>
              </div>

              <div className="flex-1 flex flex-col gap-1.5">
                {breakdown.slice(0, 5).map(b => (
                  <div key={b.category} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full shrink-0" style={{ background: b.color }} />
                    <span className="text-xs text-green-800 flex-1 truncate">{b.label}</span>
                    <span className="text-xs font-mono text-green-700">{b.pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ── DayCell ───────────────────────────────────────────────────────

function DayCell({
  day, record, isToday, isSelected, onClick,
}: {
  day: number
  record: DayRecord | undefined
  isToday: boolean
  isSelected: boolean
  onClick: () => void
}) {
  const bgColor = record
    ? record.status === 'positive' ? 'bg-green-100'
    : record.status === 'negative' ? 'bg-red-100'
    : 'bg-gray-100'
    : ''

  const net = record?.net ?? 0
  const hasData = !!record && record.transactions.length > 0

  return (
    <button
      onClick={onClick}
      className={`aspect-square rounded-xl flex flex-col items-center justify-center relative transition-all text-center p-0.5 ${bgColor} ${
        isSelected ? 'ring-2 ring-green-500' : ''
      } ${isToday ? 'ring-1 ring-green-400' : ''}`}
    >
      <span className={`text-[11px] font-semibold leading-none ${
        isToday ? 'text-green-600' : 'text-green-900/80'
      }`}>
        {day}
      </span>
      {hasData && (
        <span className={`text-[8px] font-mono leading-none mt-0.5 ${
          net >= 0 ? 'text-green-600' : 'text-red-500'
        }`}>
          {net >= 0 ? '+' : ''}{net >= 1000 ? `${(net/1000).toFixed(1)}k` : net}
        </span>
      )}
    </button>
  )
}

// ── DayDetail ─────────────────────────────────────────────────────

function DayDetail({ date, record, onClose }: { date: string; record: DayRecord; onClose: () => void }) {
  const { transactions } = record

  return (
    <div className="glass-card rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-bold text-green-900">{date}</p>
        <button onClick={onClose} className="text-green-600 hover:text-green-800">
          <X size={16} />
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-3">
        <MiniStat label="收入" value={record.totalIncome} positive />
        <MiniStat label="支出" value={record.totalExpense} />
        <MiniStat label="淨額" value={record.net} positive={record.net >= 0} />
      </div>

      {transactions.length === 0 ? (
        <p className="text-center text-xs text-green-500/50 py-3">當日無交易</p>
      ) : (
        <div className="flex flex-col gap-2">
          {transactions.map(tx => (
            <TxRow key={tx.id} tx={tx} />
          ))}
        </div>
      )}
    </div>
  )
}

function MiniStat({ label, value, positive }: { label: string; value: number; positive?: boolean }) {
  return (
    <div className="bg-green-50 rounded-xl p-2 text-center">
      <p className="text-[9px] text-green-600/70">{label}</p>
      <p className={`text-xs font-mono font-bold ${positive ? 'text-green-700' : 'text-red-500'}`}>
        {value >= 0 ? '' : '-'}NT${Math.abs(value).toLocaleString()}
      </p>
    </div>
  )
}

function TxRow({ tx }: { tx: Transaction }) {
  const cat = TX_CATEGORIES[tx.category]
  return (
    <div className="flex items-center gap-2">
      <span className="text-base">{cat?.emoji ?? '💰'}</span>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-semibold text-green-900 truncate">{cat?.label ?? tx.category}</p>
        {tx.note && <p className="text-[10px] text-green-600/70 truncate">{tx.note}</p>}
      </div>
      <span className={`text-xs font-mono font-bold shrink-0 ${tx.isIncome ? 'text-green-600' : 'text-red-500'}`}>
        {tx.isIncome ? '+' : '-'}NT${tx.amount.toLocaleString()}
      </span>
    </div>
  )
}
