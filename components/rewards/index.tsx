'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Flame, Gift } from 'lucide-react'
import { useApp } from '@/lib/store'
import { ACHIEVEMENTS, PET_STAGES, calcLevelInfo } from '@/lib/constants'
import type { AchievementType } from '@/types'

const ALL_BADGES = Object.keys(ACHIEVEMENTS) as AchievementType[]
const PET_STAGE_ORDER: (keyof typeof PET_STAGES)[] = ['egg', 'chick', 'chicken', 'legend']

// XP 來源顯示資料（括號說明不顯示）
const XP_SOURCES = [
  { key: 'tx',      label: '記帳',   icon: '📝' },
  { key: 'savings', label: '存款金額', icon: '💰' },
  { key: 'goal',    label: '完成目標', icon: '🏆' },
]

export function RewardsPage() {
  const { state, actions } = useApp()
  const { rewards, transactions, goals } = state

  const [toast, setToast]         = useState<string | null>(null)
  const [chestOpen, setChestOpen] = useState(false)
  const [chestReward, setChestReward] = useState(0)

  const info     = calcLevelInfo(rewards.xp)
  const xpPct    = Math.min(Math.round((info.xpInLevel / info.xpForLevel) * 100), 100)
  const xpLeft   = info.xpForLevel - info.xpInLevel
  const pet      = PET_STAGES[rewards.petStage]
  const chestReady = (rewards.weeklyChestStreak ?? 0) >= 7

  // 七天進度格
  const chestStreak = rewards.weeklyChestStreak ?? 0
  const weekGrid  = Array.from({ length: 7 }, (_, i) => i < chestStreak)

  function showToast(msg: string) {
    setToast(msg)
    setTimeout(() => setToast(null), 3000)
  }

  async function handleCheckIn() {
    if (rewards.hasCheckedInToday) return
    try {
      const result = await actions.checkIn()
      showToast(`✓ 簽到成功！連續 ${result.newStreak} 天`)
    } catch {
      showToast('今日已簽到')
    }
  }

  function handleOpenChest() {
    if (!chestReady) return
    try {
      const usdc = actions.claimTreasureChest()
      setChestReward(usdc)
      setChestOpen(true)
    } catch (e: unknown) {
      showToast(e instanceof Error ? e.message : '領取失敗')
    }
  }

  // XP 來源統計
  const txCount      = transactions.length
  const totalSavings = goals.reduce((s, g) => s + g.currentAmount, 0)
  const goalsDone    = goals.filter(g => g.status === 'completed').length

  const xpSourceCounts: Record<string, string> = {
    tx:      `${txCount} 次`,
    savings: `NT$ ${totalSavings.toLocaleString()}`,
    goal:    `${goalsDone} 個`,
  }

  return (
    <div className="flex flex-col min-h-screen bg-[#f0fdf4] pb-24">
      {/* ── Hero 等級區塊 ── */}
      <div className="dark-panel scan-line relative overflow-hidden px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="grid-overlay absolute inset-0 pointer-events-none opacity-50" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-600/70 text-xs font-semibold tracking-widest uppercase">任務</p>
              <div className="flex items-end gap-2 mt-1">
                <span className="font-mono text-3xl font-bold neon-text">Lv.{rewards.level}</span>
                <span className="text-green-500 text-sm mb-1 font-mono">{rewards.xp} XP</span>
              </div>
              <p className="text-green-500/60 text-xs mt-0.5 font-mono">距離下一級還需 {xpLeft} XP</p>
            </div>
            <motion.div
              className="text-6xl float select-none"
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            >
              {pet.emoji}
            </motion.div>
          </div>

          {/* XP 進度條 */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-green-700/70 mb-1">
              <span>當前經驗值 {info.xpInLevel} / {info.xpForLevel}</span>
              <span>{xpPct}%</span>
            </div>
            <div className="h-3 rounded-full bg-green-900/60 overflow-hidden">
              <motion.div
                className="h-full neon-bar rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${xpPct}%` }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4 mt-4 flex flex-col gap-4">

        {/* ── 寵物進化之路 ── */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-green-900 text-sm mb-4">寵物進化之路</h3>
          <div className="flex items-center justify-between">
            {PET_STAGE_ORDER.map((stage, i) => {
              const info2   = PET_STAGES[stage]
              const isCur   = rewards.petStage === stage
              const isPast  = PET_STAGE_ORDER.indexOf(rewards.petStage) > i

              return (
                <div key={stage} className="flex items-center gap-1">
                  <div className={`flex flex-col items-center gap-1 transition-transform ${isCur ? 'scale-110' : ''}`}>
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-3xl ${
                      isCur ? 'dark-panel glow-green' : isPast ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {info2.emoji}
                    </div>
                    <span className={`text-[10px] font-bold text-center leading-tight max-w-[56px] ${
                      isCur ? 'text-green-700' : 'text-green-500/50'
                    }`}>
                      {info2.label}
                    </span>
                    <span className="text-[9px] text-green-500/40">Lv.{info2.minLevel}</span>
                  </div>
                  {i < PET_STAGE_ORDER.length - 1 && (
                    <div className={`w-4 h-0.5 mb-7 ${isPast || isCur ? 'bg-green-400' : 'bg-green-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* ── 連續記帳 ── */}
        <motion.div
          className={`glass-card rounded-2xl p-4 cursor-pointer select-none transition-all ${chestReady ? 'ring-2 ring-amber-400/60' : ''}`}
          whileTap={{ scale: 0.98 }}
          onClick={chestReady ? handleOpenChest : undefined}
        >
          <div className="flex items-center justify-between mb-1">
            <div>
              <h3 className="font-bold text-green-900 text-sm">連續記帳</h3>
              <p className="text-[10px] text-green-600/60 mt-0.5">保持習慣持續成長</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Flame size={16} className="text-orange-400" fill="#fb923c" />
              <span className="font-mono text-lg font-bold text-orange-500">{rewards.streakDays}</span>
              <span className="text-xs text-orange-400">天</span>
            </div>
          </div>

          {/* 七天進度條 */}
          <div className="flex gap-1.5 mt-3">
            {weekGrid.map((filled, i) => (
              <div
                key={i}
                className={`flex-1 h-2.5 rounded-full transition-all ${
                  filled ? 'bg-orange-400' : 'bg-green-100'
                }`}
              />
            ))}
          </div>

          {chestReady && (
            <motion.div
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-amber-400/20 border border-amber-400/40"
            >
              <span className="text-lg">🎁</span>
              <span className="text-xs font-bold text-amber-700">點擊領取寶箱獎勵！</span>
            </motion.div>
          )}
        </motion.div>

        {/* ── 成就徽章 ── */}
        <div>
          <h3 className="font-bold text-green-900 text-sm mb-3">成就徽章</h3>
          <div className="grid grid-cols-3 gap-2">
            {ALL_BADGES.map(type => {
              const info3   = ACHIEVEMENTS[type]
              const unlocked = rewards.badges.includes(type)
              return <BadgeCard key={type} info={info3} unlocked={unlocked} />
            })}
          </div>
        </div>

        {/* ── 每日簽到按鈕 ── */}
        <motion.button
          onClick={handleCheckIn}
          disabled={rewards.hasCheckedInToday}
          whileTap={!rewards.hasCheckedInToday ? { scale: 0.97 } : {}}
          className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all ${
            rewards.hasCheckedInToday
              ? 'bg-green-200 text-green-500 cursor-default'
              : 'bg-green-500 text-white glow-green'
          }`}
        >
          {rewards.hasCheckedInToday ? '✓ 今日已簽到' : '📅 每日簽到'}
        </motion.button>

        {/* ── 經驗值來源 ── */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-green-900 text-sm mb-3">經驗值來源</h3>
          <div className="flex flex-col gap-3">
            {XP_SOURCES.map(src => (
              <div key={src.key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-base">{src.icon}</span>
                  <span className="text-sm text-green-800 font-medium">{src.label}</span>
                </div>
                <span className="text-sm font-mono text-green-600 font-bold">
                  {xpSourceCounts[src.key]}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* USDC 餘額 */}
        {(rewards.usdcBalance ?? 0) > 0 && (
          <div className="glass-card rounded-2xl p-4 flex items-center justify-between border-2 border-blue-300/30">
            <div className="flex items-center gap-2">
              <span className="text-xl">💎</span>
              <div>
                <p className="text-sm font-bold text-green-900">USDC 獎勵</p>
                <p className="text-[10px] text-green-600/60">累積寶箱獎勵</p>
              </div>
            </div>
            <span className="font-mono text-lg font-bold text-blue-600">
              {(rewards.usdcBalance ?? 0).toFixed(2)} USDC
            </span>
          </div>
        )}

        {/* 待領返現 */}
        {rewards.pendingCashback > 0 && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="glass-card rounded-2xl p-4 border-2 border-green-400/30"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Gift size={18} className="text-green-500" />
                <div>
                  <p className="text-sm font-bold text-green-900">待領返現</p>
                  <p className="text-xs text-green-600/70">連續簽到獎勵</p>
                </div>
              </div>
              <button
                onClick={() => {
                  try { actions.claimCashback(); showToast('已領取返現！') } catch {}
                }}
                className="bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-xl glow-green"
              >
                領取 {rewards.pendingCashback} 點
              </button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── 寶箱開啟 Modal ── */}
      <AnimatePresence>
        {chestOpen && (
          <>
            <motion.div
              className="fixed inset-0 bg-black/50 z-40 backdrop-blur-sm"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setChestOpen(false)}
            />
            <motion.div
              className="fixed inset-0 z-50 flex items-center justify-center px-6"
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.7, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 350, damping: 25 }}
            >
              <div className="glass-card rounded-3xl p-8 flex flex-col items-center gap-4 max-w-sm w-full">
                <motion.div
                  animate={{ rotate: [0, -15, 15, -10, 10, 0], scale: [1, 1.2, 1.1, 1.2, 1] }}
                  transition={{ duration: 0.8 }}
                  className="text-6xl"
                >
                  🎁
                </motion.div>
                <p className="text-xl font-bold text-green-900">寶箱已開啟！</p>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-3xl font-bold text-blue-600">+{chestReward.toFixed(2)}</span>
                  <span className="text-lg font-bold text-blue-500">USDC</span>
                </div>
                <p className="text-xs text-green-600/60 text-center">已存入你的錢包，繼續保持連續登入！</p>
                <button
                  onClick={() => setChestOpen(false)}
                  className="w-full py-3 rounded-2xl bg-green-500 text-white font-bold text-base glow-green"
                >
                  太棒了！
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Toast */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-28 left-1/2 -translate-x-1/2 z-50 dark-panel px-5 py-3 rounded-2xl text-green-300 text-sm font-semibold whitespace-nowrap glow-green"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── BadgeCard ────────────────────────────────────────────────

function BadgeCard({
  info, unlocked,
}: {
  info: { label: string; description: string; emoji: string; pointsReward: number }
  unlocked: boolean
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className={`rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center transition-all ${
        unlocked
          ? 'bg-gradient-to-b from-yellow-50 to-amber-50 border-2 border-amber-400/60 shadow-sm'
          : 'bg-gray-100 border border-gray-200'
      }`}
    >
      <div className={`text-2xl ${!unlocked ? 'grayscale opacity-30' : ''}`}>
        {info.emoji}
      </div>
      <p className={`text-[10px] font-bold leading-tight ${unlocked ? 'text-amber-700' : 'text-gray-400'}`}>
        {info.label}
      </p>
      {unlocked && (
        <p className="text-[9px] leading-tight text-amber-600/70">{info.description}</p>
      )}
    </motion.div>
  )
}
