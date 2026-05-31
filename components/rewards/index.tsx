'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Star, Flame, Gift } from 'lucide-react'
import { useApp } from '@/lib/store'
import { ACHIEVEMENTS, PET_STAGES, XP_PER_LEVEL } from '@/lib/constants'
import type { AchievementType } from '@/types'

const ALL_BADGES = Object.keys(ACHIEVEMENTS) as AchievementType[]

const PET_STAGE_ORDER: (keyof typeof PET_STAGES)[] = ['egg', 'chick', 'chicken', 'legend']

export function RewardsPage() {
  const { state, actions } = useApp()
  const { rewards } = state

  const [toast, setToast]   = useState<string | null>(null)
  const [claiming, setClaiming] = useState(false)

  const xpInLevel   = rewards.xp % (rewards.level * XP_PER_LEVEL)
  const xpThisLevel = rewards.level * XP_PER_LEVEL
  const xpPct       = Math.min(Math.round((xpInLevel / xpThisLevel) * 100), 100)

  const pet = PET_STAGES[rewards.petStage]

  async function handleCheckIn() {
    if (rewards.hasCheckedInToday) return
    try {
      const result = await actions.checkIn()
      setToast(`+${result.xpEarned} XP！連續 ${result.newStreak} 天 🎉`)
      setTimeout(() => setToast(null), 3000)
    } catch {}
  }

  function handleClaimCashback() {
    if (!rewards.pendingCashback) return
    setClaiming(true)
    setTimeout(() => {
      try {
        actions.claimCashback()
        setToast(`已領取 ${rewards.pendingCashback} 點返現！`)
        setTimeout(() => setToast(null), 3000)
      } catch {}
      setClaiming(false)
    }, 600)
  }

  // Build 7-day streak grid
  const today = Math.floor(Date.now() / 86400000)
  const streakGrid = Array.from({ length: 7 }).map((_, i) => {
    const dayIdx = today - (6 - i)
    const filled = dayIdx >= rewards.lastCheckinDay - rewards.streakDays + 1 && dayIdx <= rewards.lastCheckinDay
    return { filled, isToday: dayIdx === today }
  })

  return (
    <div className="flex flex-col min-h-screen bg-[#f0fdf4] pb-6">
      {/* Hero */}
      <div className="dark-panel scan-line relative overflow-hidden px-5 pt-10 pb-6 rounded-b-3xl">
        <div className="grid-overlay absolute inset-0 pointer-events-none opacity-50" />
        <div className="relative z-10">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-green-600/70 text-xs font-semibold tracking-widest uppercase">Rewards</p>
              <div className="flex items-end gap-2 mt-1">
                <span className="font-mono text-3xl font-bold neon-text">Lv.{rewards.level}</span>
                <span className="text-green-500 text-sm mb-1 font-mono">{rewards.xp} XP</span>
              </div>
              <div className="flex items-center gap-1.5 mt-1">
                <Star size={13} className="text-yellow-400" fill="#facc15" />
                <span className="text-green-400 font-mono text-sm font-bold">{rewards.points} 積分</span>
              </div>
            </div>
            <motion.div
              className="text-6xl float select-none"
              animate={{ y: [0, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2.8, ease: 'easeInOut' }}
            >
              {pet.emoji}
            </motion.div>
          </div>

          {/* XP bar */}
          <div className="mt-4">
            <div className="flex justify-between text-[10px] text-green-700/70 mb-1">
              <span>進度 {xpInLevel} / {xpThisLevel}</span>
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
        {/* Daily check-in */}
        <div className="glass-card rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-green-900 text-sm">每日簽到</h3>
            <div className="flex items-center gap-1">
              <Flame size={13} className="text-orange-400" />
              <span className="text-xs font-bold text-orange-500 font-mono">{rewards.streakDays} 天連續</span>
            </div>
          </div>

          {/* 7-day grid */}
          <div className="flex gap-1.5 mb-4">
            {streakGrid.map((d, i) => (
              <div
                key={i}
                className={`flex-1 aspect-square rounded-lg flex items-center justify-center text-sm transition-all ${
                  d.filled ? 'bg-orange-500/20 border border-orange-500/40' : 'bg-green-100 border border-green-200'
                } ${d.isToday ? 'ring-1 ring-green-500' : ''}`}
              >
                {d.filled ? '🔥' : <span className="w-2 h-2 rounded-full bg-green-200 block" />}
              </div>
            ))}
          </div>

          <motion.button
            onClick={handleCheckIn}
            disabled={rewards.hasCheckedInToday}
            whileTap={!rewards.hasCheckedInToday ? { scale: 0.96 } : {}}
            className={`w-full py-3.5 rounded-2xl font-bold text-base transition-all ${
              rewards.hasCheckedInToday
                ? 'bg-green-200 text-green-500 cursor-default'
                : 'bg-green-500 text-white glow-green pulse-ring'
            }`}
          >
            {rewards.hasCheckedInToday ? '✓ 今日已簽到' : '📅 立即簽到 +10 XP'}
          </motion.button>
        </div>

        {/* Pending cashback */}
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
                onClick={handleClaimCashback}
                disabled={claiming}
                className="bg-green-500 text-white text-sm font-bold px-4 py-2 rounded-xl glow-green disabled:opacity-60 transition-all"
              >
                {claiming ? '領取中...' : `領取 ${rewards.pendingCashback} 點`}
              </button>
            </div>
          </motion.div>
        )}

        {/* Pet evolution */}
        <div className="glass-card rounded-2xl p-4">
          <h3 className="font-bold text-green-900 text-sm mb-3">寵物進化路徑</h3>
          <div className="flex items-center justify-between">
            {PET_STAGE_ORDER.map((stage, i) => {
              const info = PET_STAGES[stage]
              const isCurrent = rewards.petStage === stage
              const isPast    = PET_STAGE_ORDER.indexOf(rewards.petStage) > i

              return (
                <div key={stage} className="flex items-center gap-1">
                  <div className={`flex flex-col items-center gap-1 ${isCurrent ? 'scale-110' : ''} transition-transform`}>
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${
                      isCurrent ? 'dark-panel glow-green' : isPast ? 'bg-green-100' : 'bg-gray-100'
                    }`}>
                      {info.emoji}
                    </div>
                    <span className={`text-[9px] font-semibold text-center leading-tight max-w-[48px] ${
                      isCurrent ? 'text-green-600' : 'text-green-500/60'
                    }`}>
                      {info.label}
                    </span>
                    <span className="text-[8px] text-green-500/50">Lv.{info.minLevel}</span>
                  </div>
                  {i < PET_STAGE_ORDER.length - 1 && (
                    <div className={`w-4 h-0.5 mb-6 ${isPast || isCurrent ? 'bg-green-400' : 'bg-green-200'}`} />
                  )}
                </div>
              )
            })}
          </div>
        </div>

        {/* Badges */}
        <div>
          <h3 className="font-bold text-green-900 text-sm mb-3">成就徽章</h3>
          <div className="grid grid-cols-3 gap-2">
            {ALL_BADGES.map(type => {
              const info    = ACHIEVEMENTS[type]
              const unlocked = rewards.badges.includes(type)
              return (
                <BadgeCard key={type} type={type} info={info} unlocked={unlocked} />
              )
            })}
          </div>
        </div>
      </div>

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

function BadgeCard({
  type, info, unlocked,
}: {
  type: AchievementType
  info: { label: string; description: string; emoji: string; pointsReward: number }
  unlocked: boolean
}) {
  return (
    <motion.div
      whileTap={{ scale: 0.96 }}
      className={`rounded-2xl p-3 flex flex-col items-center gap-1.5 text-center transition-all ${
        unlocked
          ? 'dark-panel glow-green'
          : 'bg-gray-100 border border-gray-200'
      }`}
    >
      <div className={`text-2xl ${!unlocked ? 'grayscale opacity-40' : ''}`}>
        {info.emoji}
      </div>
      {!unlocked && (
        <Lock size={10} className="text-gray-400 -mt-1" />
      )}
      <p className={`text-[10px] font-bold leading-tight ${unlocked ? 'text-green-400' : 'text-gray-400'}`}>
        {info.label}
      </p>
      <p className={`text-[9px] leading-tight ${unlocked ? 'text-green-600/70' : 'text-gray-400/70'}`}>
        {info.description}
      </p>
      {unlocked && (
        <div className="flex items-center gap-0.5 mt-0.5">
          <Star size={8} className="text-yellow-400" fill="#facc15" />
          <span className="text-[9px] text-yellow-500 font-mono">{info.pointsReward}pts</span>
        </div>
      )}
    </motion.div>
  )
}
