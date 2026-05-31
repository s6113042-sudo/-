'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { ChevronRight, TrendingUp, Shield, Zap, Check } from 'lucide-react'
import { useApp } from '@/lib/store'

type RiskLevel = 1 | 2 | 3

const INCOME_PRESETS = [20000, 30000, 50000, 80000]

const RISK_OPTIONS: { value: RiskLevel; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
  { value: 1, label: '保守', desc: '穩健為主，低風險', icon: <Shield size={20} />, color: '#14b8a6' },
  { value: 2, label: '穩健', desc: '兼顧成長與安全',   icon: <TrendingUp size={20} />, color: '#22c55e' },
  { value: 3, label: '積極', desc: '追求高報酬',       icon: <Zap size={20} />,       color: '#f59e0b' },
]

const COOLDOWN_OPTIONS = [0, 12, 24, 48]

const slideVariants = {
  enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit:  (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0 }),
}

export function Onboarding() {
  const router = useRouter()
  const { actions } = useApp()

  const [step, setStep]         = useState(0)
  const [direction, setDir]     = useState(1)
  const [income, setIncome]     = useState<number | ''>('')
  const [risk, setRisk]         = useState<RiskLevel>(2)
  const [budget, setBudget]     = useState<number | ''>(3000)
  const [cooldown, setCooldown] = useState(24)
  const [done, setDone]         = useState(false)

  const totalSteps = 4

  function goNext() {
    setDir(1)
    setStep(s => Math.min(s + 1, totalSteps - 1))
  }
  function goPrev() {
    setDir(-1)
    setStep(s => Math.max(s - 1, 0))
  }

  async function handleFinish() {
    actions.onboard({
      monthlyIncome: Number(income) || 0,
      riskLevel: risk,
      dailyBudget: Number(budget) || 3000,
      impulseCooldownHours: cooldown,
    })
    setDone(true)
    setTimeout(() => router.push('/dashboard'), 1200)
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#f0fdf4] relative overflow-hidden px-6">
      {/* dot grid */}
      <div className="absolute inset-0 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle, #16a34a10 1px, transparent 1px)',
        backgroundSize: '22px 22px',
      }} />

      {/* step dots */}
      <div className="absolute top-8 flex gap-2">
        {Array.from({ length: totalSteps }).map((_, i) => (
          <motion.div
            key={i}
            animate={{ width: i === step ? 24 : 8, background: i <= step ? '#22c55e' : '#bbf7d0' }}
            transition={{ duration: 0.3 }}
            className="h-2 rounded-full"
          />
        ))}
      </div>

      <div className="w-full max-w-sm relative overflow-hidden">
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={step}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.3, ease: 'easeInOut' }}
          >
            {step === 0 && <StepWelcome onNext={goNext} />}
            {step === 1 && (
              <StepIncome
                income={income}
                setIncome={setIncome}
                onNext={goNext}
                onPrev={goPrev}
              />
            )}
            {step === 2 && (
              <StepSettings
                risk={risk} setRisk={setRisk}
                budget={budget} setBudget={setBudget}
                cooldown={cooldown} setCooldown={setCooldown}
                onNext={goNext} onPrev={goPrev}
              />
            )}
            {step === 3 && (
              <StepFinish done={done} onFinish={handleFinish} onPrev={goPrev} />
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}

// ── Step 1: Welcome ──────────────────────────────────────────────

function StepWelcome({ onNext }: { onNext: () => void }) {
  return (
    <div className="text-center flex flex-col items-center gap-6">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.1, type: 'spring' }}
        className="text-7xl float"
      >
        🌿
      </motion.div>
      <div>
        <h1 className="text-3xl font-bold neon-text tracking-tight">GoalFlow</h1>
        <p className="text-green-700/80 mt-1 text-sm">智能財務目標系統</p>
      </div>
      <div className="flex flex-col gap-2 w-full mt-2">
        {[
          { emoji: '🎯', label: '目標驅動理財' },
          { emoji: '🔥', label: '每日簽到獎勵' },
          { emoji: '🌐', label: 'Sui 鏈上存證' },
          { emoji: '🐣', label: '寵物養成系統' },
        ].map(({ emoji, label }) => (
          <div key={label} className="glass-card rounded-xl px-4 py-2.5 flex items-center gap-3">
            <span className="text-xl">{emoji}</span>
            <span className="text-sm font-medium text-green-800">{label}</span>
          </div>
        ))}
      </div>
      <button
        onClick={onNext}
        className="mt-4 w-full py-3 rounded-2xl bg-green-500 text-white font-semibold text-base glow-green flex items-center justify-center gap-2 active:scale-95 transition-transform"
      >
        開始設定 <ChevronRight size={18} />
      </button>
    </div>
  )
}

// ── Step 2: Income ───────────────────────────────────────────────

function StepIncome({
  income, setIncome, onNext, onPrev,
}: {
  income: number | ''
  setIncome: (v: number | '') => void
  onNext: () => void
  onPrev: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-green-900">月收入</h2>
        <p className="text-green-700/70 text-sm mt-1">用於計算每月儲蓄目標與預算</p>
      </div>
      <div className="dark-panel rounded-2xl p-4 flex items-center gap-3">
        <span className="neon-text font-mono text-lg">NT$</span>
        <input
          type="number"
          value={income}
          onChange={e => setIncome(e.target.value === '' ? '' : Number(e.target.value))}
          placeholder="0"
          className="flex-1 bg-transparent font-mono text-2xl text-green-300 outline-none placeholder:text-green-800/40 w-0"
        />
      </div>
      <div className="grid grid-cols-4 gap-2">
        {INCOME_PRESETS.map(v => (
          <button
            key={v}
            onClick={() => setIncome(v)}
            className={`rounded-xl py-2 text-xs font-mono font-semibold border transition-all ${
              income === v
                ? 'bg-green-500/20 border-green-500 text-green-400'
                : 'bg-white/60 border-green-200 text-green-700 hover:border-green-400'
            }`}
          >
            {v >= 10000 ? `${v / 1000}k` : v}
          </button>
        ))}
      </div>
      <div className="flex gap-3 mt-2">
        <button onClick={onPrev} className="flex-1 py-3 rounded-2xl border border-green-300 text-green-700 font-semibold active:scale-95 transition-transform">
          返回
        </button>
        <button
          onClick={onNext}
          disabled={!income}
          className="flex-2 flex-[2] py-3 rounded-2xl bg-green-500 text-white font-semibold glow-green disabled:opacity-40 active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          下一步 <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// ── Step 3: Settings ─────────────────────────────────────────────

function StepSettings({
  risk, setRisk, budget, setBudget, cooldown, setCooldown, onNext, onPrev,
}: {
  risk: RiskLevel; setRisk: (v: RiskLevel) => void
  budget: number | ''; setBudget: (v: number | '') => void
  cooldown: number; setCooldown: (v: number) => void
  onNext: () => void; onPrev: () => void
}) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-xl font-bold text-green-900">偏好設定</h2>
        <p className="text-green-700/70 text-sm mt-1">個人化你的理財體驗</p>
      </div>

      {/* Risk */}
      <div>
        <p className="text-sm font-semibold text-green-800 mb-2">風險等級</p>
        <div className="flex gap-2">
          {RISK_OPTIONS.map(opt => (
            <button
              key={opt.value}
              onClick={() => setRisk(opt.value)}
              style={{ borderColor: risk === opt.value ? opt.color : 'transparent' }}
              className={`flex-1 rounded-xl p-3 border-2 transition-all ${
                risk === opt.value ? 'bg-green-900/10' : 'bg-white/60 border-green-100'
              }`}
            >
              <div style={{ color: opt.color }} className="flex justify-center mb-1">{opt.icon}</div>
              <div className="text-xs font-bold text-green-900">{opt.label}</div>
              <div className="text-[10px] text-green-700/70 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Daily budget */}
      <div>
        <p className="text-sm font-semibold text-green-800 mb-2">每日預算 (NT$)</p>
        <div className="dark-panel rounded-xl px-4 py-3 flex items-center gap-2">
          <span className="neon-text font-mono text-sm">NT$</span>
          <input
            type="number"
            value={budget}
            onChange={e => setBudget(e.target.value === '' ? '' : Number(e.target.value))}
            className="flex-1 bg-transparent font-mono text-lg text-green-300 outline-none w-0"
          />
        </div>
      </div>

      {/* Cooldown */}
      <div>
        <p className="text-sm font-semibold text-green-800 mb-2">衝動消費冷靜期</p>
        <div className="grid grid-cols-4 gap-2">
          {COOLDOWN_OPTIONS.map(h => (
            <button
              key={h}
              onClick={() => setCooldown(h)}
              className={`rounded-xl py-2 text-xs font-semibold border transition-all ${
                cooldown === h
                  ? 'bg-green-500/20 border-green-500 text-green-400'
                  : 'bg-white/60 border-green-200 text-green-700 hover:border-green-400'
              }`}
            >
              {h === 0 ? '關閉' : `${h}h`}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-3 mt-2">
        <button onClick={onPrev} className="flex-1 py-3 rounded-2xl border border-green-300 text-green-700 font-semibold active:scale-95 transition-transform">
          返回
        </button>
        <button
          onClick={onNext}
          className="flex-[2] py-3 rounded-2xl bg-green-500 text-white font-semibold glow-green active:scale-95 transition-transform flex items-center justify-center gap-2"
        >
          下一步 <ChevronRight size={18} />
        </button>
      </div>
    </div>
  )
}

// ── Step 4: Finish ───────────────────────────────────────────────

function StepFinish({
  done, onFinish, onPrev,
}: {
  done: boolean; onFinish: () => void; onPrev: () => void
}) {
  return (
    <div className="text-center flex flex-col items-center gap-6">
      <motion.div
        animate={done ? { scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] } : {}}
        transition={{ duration: 0.6 }}
        className="text-7xl"
      >
        {done ? '🎉' : '🚀'}
      </motion.div>
      <div>
        <h2 className="text-2xl font-bold text-green-900">{done ? '正在啟動...' : '準備好了！'}</h2>
        <p className="text-green-700/70 text-sm mt-1 max-w-xs">
          GoalFlow 已根據你的偏好設定完成，讓我們開始追蹤你的財務目標吧
        </p>
      </div>
      {!done && (
        <div className="w-full flex flex-col gap-3 mt-2">
          <button
            onClick={onFinish}
            className="w-full py-3.5 rounded-2xl bg-green-500 text-white font-bold text-base glow-green pulse-ring active:scale-95 transition-transform flex items-center justify-center gap-2"
          >
            <Check size={20} /> 進入系統
          </button>
          <button onClick={onPrev} className="w-full py-3 rounded-2xl border border-green-300 text-green-700 font-semibold active:scale-95 transition-transform">
            返回
          </button>
        </div>
      )}
      {done && (
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 1.0, ease: 'easeInOut' }}
          className="w-full h-1.5 rounded-full neon-bar origin-left"
        />
      )}
    </div>
  )
}
