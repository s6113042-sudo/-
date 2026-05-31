/**
 * GoalFlow API 層
 */

import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addMonths, setDate, nextDay, type Day } from 'date-fns'
import type {
  Goal, Transaction, RewardAccount, AllocationPlan,
  GapAnalysis, DayRecord, CalendarData, CategoryBreakdown,
  AchievementType, TxCategory, RecurringExpense, RecurringFrequency,
} from '@/types'
import {
  ACHIEVEMENTS, TX_CATEGORIES, XP_PER_LEVEL, calcLevelInfo,
} from './constants'

// ─── localStorage keys ───────────────────────
const KEYS = {
  goals:        'gf_goals',
  transactions: 'gf_transactions',
  rewards:      'gf_rewards',
  profile:      'gf_profile',
  allocation:   'gf_allocation',
}

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw ? JSON.parse(raw) : fallback
  } catch { return fallback }
}
function save(key: string, val: unknown) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

// ─── 目標 Service ─────────────────────────────

export const goalService = {
  getAll(): Goal[] {
    return load<Goal[]>(KEYS.goals, []).map(enrichGoal)
  },

  create(data: Omit<Goal, 'id' | 'createdAt' | 'progressPct' | 'daysLeft' | 'monthlyGap' | 'onChainId'>): Goal {
    const goals = load<Goal[]>(KEYS.goals, [])
    const goal: Goal = {
      ...data,
      id: crypto.randomUUID(),
      createdAt: Date.now(),
      progressPct: 0,
      daysLeft: Math.ceil((data.deadlineMs - Date.now()) / 86400000),
      monthlyGap: 0,
      onChainId: null,
    }
    goals.push(goal)
    save(KEYS.goals, goals)
    return enrichGoal(goal)
  },

  update(id: string, patch: Partial<Goal>): Goal {
    const goals = load<Goal[]>(KEYS.goals, [])
    const idx = goals.findIndex(g => g.id === id)
    if (idx === -1) throw new Error('Goal not found')
    goals[idx] = { ...goals[idx], ...patch }
    save(KEYS.goals, goals)
    return enrichGoal(goals[idx])
  },

  delete(id: string) {
    const goals = load<Goal[]>(KEYS.goals, []).filter(g => g.id !== id)
    save(KEYS.goals, goals)
  },

  addProgress(id: string, amount: number): Goal {
    const goals = load<Goal[]>(KEYS.goals, [])
    const idx = goals.findIndex(g => g.id === id)
    if (idx === -1) throw new Error('Goal not found')
    goals[idx].currentAmount += amount
    if (goals[idx].currentAmount >= goals[idx].targetAmount) {
      goals[idx].status = 'completed'
    }
    save(KEYS.goals, goals)
    return enrichGoal(goals[idx])
  },
}

function enrichGoal(g: Goal): Goal {
  const progressPct = Math.min(Math.round((g.currentAmount / g.targetAmount) * 100), 100)
  const daysLeft    = Math.max(0, Math.ceil((g.deadlineMs - Date.now()) / 86400000))
  const monthsLeft  = Math.max(1, Math.ceil(daysLeft / 30))
  const monthlyGap  = g.currentAmount >= g.targetAmount
    ? 0
    : Math.ceil((g.targetAmount - g.currentAmount) / monthsLeft)
  return { ...g, progressPct, daysLeft, monthlyGap }
}

// ─── 交易 Service ─────────────────────────────

export const txService = {
  getAll(): Transaction[] {
    return load<Transaction[]>(KEYS.transactions, [])
  },

  add(data: Omit<Transaction, 'id' | 'date'>): Transaction {
    const list = load<Transaction[]>(KEYS.transactions, [])
    const tx: Transaction = {
      ...data,
      comment: (data.comment ?? ''),
      id:   crypto.randomUUID(),
      date: format(new Date(data.timestampMs), 'yyyy-MM-dd'),
    }
    list.unshift(tx)
    save(KEYS.transactions, list)
    return tx
  },

  delete(id: string) {
    const list = load<Transaction[]>(KEYS.transactions, []).filter(t => t.id !== id)
    save(KEYS.transactions, list)
  },

  updateComment(id: string, comment: string): Transaction | null {
    const list = load<Transaction[]>(KEYS.transactions, [])
    const idx  = list.findIndex(t => t.id === id)
    if (idx === -1) return null
    list[idx] = { ...list[idx], comment }
    save(KEYS.transactions, list)
    return list[idx]
  },

  getCalendarData(year: number, month: number): CalendarData {
    const allTx = load<Transaction[]>(KEYS.transactions, [])
    const start = startOfMonth(new Date(year, month - 1))
    const end   = endOfMonth(start)
    const days  = eachDayOfInterval({ start, end })
    const result: CalendarData = {}

    for (const day of days) {
      const dateStr = format(day, 'yyyy-MM-dd')
      const dayTxs  = allTx.filter(t => t.date === dateStr)
      const totalIncome  = dayTxs.filter(t => t.isIncome).reduce((s, t) => s + t.amount, 0)
      const totalExpense = dayTxs.filter(t => !t.isIncome).reduce((s, t) => s + t.amount, 0)
      const net = totalIncome - totalExpense
      result[dateStr] = {
        date: dateStr,
        totalIncome,
        totalExpense,
        net,
        status: dayTxs.length === 0 ? 'empty' : net >= 0 ? 'positive' : 'negative',
        transactions: dayTxs,
        goalDeposits: dayTxs.filter(t => t.goalId).map(t => ({ goalId: t.goalId!, amount: t.amount })),
        targetMet: net >= 0,
      }
    }
    return result
  },

  getCategoryBreakdown(from: number, to: number): CategoryBreakdown[] {
    const txs    = load<Transaction[]>(KEYS.transactions, []).filter(t => t.timestampMs >= from && t.timestampMs <= to && !t.isIncome)
    const total  = txs.reduce((s, t) => s + t.amount, 0)
    const map    = new Map<TxCategory, number>()
    for (const t of txs) map.set(t.category, (map.get(t.category) || 0) + t.amount)

    return Array.from(map.entries()).map(([cat, amount]) => ({
      category: cat,
      label:    TX_CATEGORIES[cat]?.label ?? cat,
      amount,
      pct:      total > 0 ? Math.round((amount / total) * 100) : 0,
      color:    TX_CATEGORIES[cat]?.color ?? '#94a3b8',
    })).sort((a, b) => b.amount - a.amount)
  },
}

// ─── 獎勵 Service ─────────────────────────────

const DEFAULT_REWARDS: RewardAccount = {
  level: 1, xp: 0, xpToNextLevel: XP_PER_LEVEL, points: 0,
  streakDays: 0, maxStreak: 0, lastCheckinDay: 0, totalCheckins: 0,
  hasCheckedInToday: false, petStage: 'egg', petXp: 0,
  badges: [], pendingCashback: 0,
  dailyTxXp: 0, dailyTxDate: '', weeklyChestStreak: 0, usdcBalance: 0,
}

function todayDayIndex() { return Math.floor((Date.now() + 8 * 3600_000) / 86_400_000) }

function calcPetStage(level: number): RewardAccount['petStage'] {
  if (level >= 10) return 'legend'
  if (level >= 6)  return 'chicken'
  if (level >= 3)  return 'chick'
  return 'egg'
}

// 生成寶箱獎勵，期望值 ≈ 0.3 USDC
function generateChestReward(): number {
  const r = Math.random()
  let reward: number
  if (r < 0.45) {
    reward = 0.01 + Math.random() * 0.14   // 45%: 0.01-0.15, avg 0.08
  } else if (r < 0.80) {
    reward = 0.15 + Math.random() * 0.35   // 35%: 0.15-0.50, avg 0.325
  } else {
    reward = 0.50 + Math.random() * 0.50   // 20%: 0.50-1.00, avg 0.75
  }
  // Expected ≈ 0.45×0.08 + 0.35×0.325 + 0.20×0.75 ≈ 0.30
  return Math.round(reward * 100) / 100
}

export const rewardService = {
  get(): RewardAccount {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    // 補上可能沒有的新欄位（舊存檔相容）
    r.dailyTxXp         = r.dailyTxXp         ?? 0
    r.dailyTxDate       = r.dailyTxDate        ?? ''
    r.weeklyChestStreak = r.weeklyChestStreak  ?? 0
    r.usdcBalance       = r.usdcBalance        ?? 0

    const info = calcLevelInfo(r.xp)
    r.level          = info.level
    r.xpToNextLevel  = info.xpForLevel - info.xpInLevel
    r.petStage       = calcPetStage(r.level)
    r.hasCheckedInToday = r.lastCheckinDay === todayDayIndex()
    return r
  },

  checkIn(): { xpEarned: number; pointsEarned: number; newStreak: number } {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    r.dailyTxXp         = r.dailyTxXp         ?? 0
    r.dailyTxDate       = r.dailyTxDate        ?? ''
    r.weeklyChestStreak = r.weeklyChestStreak  ?? 0
    r.usdcBalance       = r.usdcBalance        ?? 0

    const today = todayDayIndex()
    if (r.lastCheckinDay === today) throw new Error('已簽到')

    const consecutive = r.lastCheckinDay + 1 === today
    r.streakDays    = consecutive ? r.streakDays + 1 : 1
    r.maxStreak     = Math.max(r.maxStreak, r.streakDays)
    r.lastCheckinDay = today
    r.totalCheckins += 1

    // 週期寶箱計數
    r.weeklyChestStreak = consecutive ? r.weeklyChestStreak + 1 : 1

    const xp  = 5     // 簽到給少量 XP
    const pts = 5
    r.xp     += xp
    r.points += pts
    r.petXp  += xp

    const info = calcLevelInfo(r.xp)
    r.level    = info.level
    r.petStage = calcPetStage(r.level)

    // 自動解鎖成就
    if (r.streakDays >= 100 && !r.badges.includes('STREAK_100'))
      rewardService._unlockBadge(r, 'STREAK_100')
    if (r.petStage === 'chick'   && !r.badges.includes('FIRST_LOGIN'))
      rewardService._unlockBadge(r, 'FIRST_LOGIN')

    save(KEYS.rewards, r)
    return { xpEarned: xp, pointsEarned: pts, newStreak: r.streakDays }
  },

  // 每次記帳 +5 XP，單日上限 20
  awardTransactionXp(): number {
    const r    = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    r.dailyTxXp   = r.dailyTxXp   ?? 0
    r.dailyTxDate = r.dailyTxDate  ?? ''
    const todayStr = format(new Date(Date.now() + 8 * 3600_000), 'yyyy-MM-dd')
    if (r.dailyTxDate !== todayStr) {
      r.dailyTxXp  = 0
      r.dailyTxDate = todayStr
    }
    const remaining = Math.max(0, 20 - r.dailyTxXp)
    const xp = Math.min(5, remaining)
    if (xp > 0) {
      r.xp        += xp
      r.petXp     += xp
      r.dailyTxXp += xp
      const info = calcLevelInfo(r.xp)
      r.level    = info.level
      r.petStage = calcPetStage(r.level)
      save(KEYS.rewards, r)
    }
    return xp
  },

  // 每存 1000 元 +1 XP
  awardSavingsXp(amount: number): number {
    const xp = Math.floor(amount / 1000)
    if (xp <= 0) return 0
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    r.xp    += xp
    r.petXp += xp
    const info = calcLevelInfo(r.xp)
    r.level    = info.level
    r.petStage = calcPetStage(r.level)
    save(KEYS.rewards, r)
    return xp
  },

  // 目標完成 XP
  awardGoalCompleteXp(targetAmount: number): number {
    const xp = targetAmount < 10000 ? 10 : 25
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    r.xp    += xp
    r.petXp += xp
    const info = calcLevelInfo(r.xp)
    r.level    = info.level
    r.petStage = calcPetStage(r.level)
    save(KEYS.rewards, r)
    return xp
  },

  // 領取週寶箱（需 weeklyChestStreak >= 7）
  claimTreasureChest(): number {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    r.weeklyChestStreak = r.weeklyChestStreak ?? 0
    r.usdcBalance       = r.usdcBalance       ?? 0
    if (r.weeklyChestStreak < 7) throw new Error('尚未達到 7 天連續登入')
    const reward = generateChestReward()
    r.usdcBalance       += reward
    r.weeklyChestStreak = 0   // 重新計數
    save(KEYS.rewards, r)
    return reward
  },

  claimCashback(): number {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    const amt = r.pendingCashback
    if (!amt) throw new Error('無待領返現')
    r.points += amt
    r.pendingCashback = 0
    save(KEYS.rewards, r)
    return amt
  },

  unlockBadge(type: AchievementType) {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    rewardService._unlockBadge(r, type)
    save(KEYS.rewards, r)
  },

  _unlockBadge(r: RewardAccount, type: AchievementType) {
    if (!r.badges.includes(type)) {
      r.badges.push(type)
      r.points += ACHIEVEMENTS[type]?.pointsReward ?? 0
    }
  },

  awardXp(amount: number) {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    r.xp    += amount
    r.petXp += amount
    const info = calcLevelInfo(r.xp)
    r.level    = info.level
    r.petStage = calcPetStage(r.level)
    save(KEYS.rewards, r)
  },
}

// ─── 固定支出 Service ────────────────────────────────

function calcNextDueDate(frequency: RecurringFrequency, dayOf: number): string {
  const now = new Date()
  if (frequency === 'monthly') {
    let d = setDate(now, dayOf)
    if (d <= now) d = setDate(addMonths(now, 1), dayOf)
    return format(d, 'yyyy-MM-dd')
  } else {
    const next = nextDay(now, dayOf as Day)
    return format(next, 'yyyy-MM-dd')
  }
}

export const recurringService = {
  getAll(): RecurringExpense[] {
    return load<RecurringExpense[]>('gf_recurring', [])
  },

  add(data: Omit<RecurringExpense, 'id' | 'nextDueDate' | 'createdAt'>): RecurringExpense {
    const list = load<RecurringExpense[]>('gf_recurring', [])
    const item: RecurringExpense = {
      ...data,
      id: crypto.randomUUID(),
      nextDueDate: calcNextDueDate(data.frequency, data.dayOf),
      createdAt: Date.now(),
    }
    list.push(item)
    save('gf_recurring', list)
    return item
  },

  delete(id: string) {
    const list = load<RecurringExpense[]>('gf_recurring', []).filter(r => r.id !== id)
    save('gf_recurring', list)
  },

  toggleActive(id: string) {
    const list = load<RecurringExpense[]>('gf_recurring', [])
    const idx = list.findIndex(r => r.id === id)
    if (idx !== -1) list[idx].isActive = !list[idx].isActive
    save('gf_recurring', list)
  },

  getMonthlyTotal(): number {
    return load<RecurringExpense[]>('gf_recurring', [])
      .filter(r => r.isActive)
      .reduce((s, r) => s + (r.frequency === 'monthly' ? r.amount : r.amount * 4.33), 0)
  },

  getDueSoon(withinDays = 7): RecurringExpense[] {
    const limit = format(addDays(new Date(), withinDays), 'yyyy-MM-dd')
    return load<RecurringExpense[]>('gf_recurring', [])
      .filter(r => r.isActive && r.nextDueDate <= limit)
  },
}

export const financeService = {
  getGapAnalysis(income: number, goals: Goal[]): GapAnalysis {
    const totalMonthlyNeed = goals
      .filter(g => g.status === 'active')
      .reduce((s, g) => s + g.monthlyGap, 0)
    const surplus  = income - totalMonthlyNeed
    const breakdown = goals.filter(g => g.status === 'active').map(g => ({
      goalId: g.id,
      name:   g.name,
      monthlyNeed: g.monthlyGap,
      pct:    income > 0 ? Math.round((g.monthlyGap / income) * 100) : 0,
    }))
    const recommendations = surplus < 0
      ? goals
          .filter(g => g.status === 'active')
          .sort((a, b) => b.monthlyGap - a.monthlyGap)
          .slice(0, 3)
          .map(g => ({ goalId: g.id, name: g.name, suggestedCut: Math.ceil(g.monthlyGap * 0.15) }))
      : []
    return { monthlyIncome: income, totalMonthlyNeed, surplus, isDeficit: surplus < 0, goalBreakdown: breakdown, recommendations }
  },

  /**
   * 智慧分配公式
   * 確保生活費 >= 30%、緊急備用 >= 5%
   * 隨時間推進動態調整目標儲蓄比例，落後時加 10% 安全緩衝
   */
  calcAllocation(goal: Goal, monthlyIncome: number): {
    livingPct: number
    savingsPct: number
    emergencyPct: number
    investmentPct: number
  } {
    if (monthlyIncome <= 0 || goal.status !== 'active') {
      return { livingPct: 60, savingsPct: 15, emergencyPct: 10, investmentPct: 15 }
    }

    const remaining   = Math.max(0, goal.targetAmount - goal.currentAmount)
    const monthsLeft  = Math.max(1, goal.daysLeft / 30)
    const totalDays   = Math.max(1, (goal.deadlineMs - goal.createdAt) / 86400000)
    const daysElapsed = totalDays - goal.daysLeft
    const expected    = goal.targetAmount * (daysElapsed / totalDays)
    const aheadRatio  = expected > 0 ? goal.currentAmount / expected : 1
    const progressRatio = goal.targetAmount > 0 ? goal.currentAmount / goal.targetAmount : 0

    // 落後進度時加最多 10% 安全緩衝，避免市場波動影響
    const buffer          = aheadRatio < 1 ? (1 - progressRatio) * 0.10 : 0
    const adjustedMonthly = (remaining / monthsLeft) * (1 + buffer)
    const rawSavingsPct   = (adjustedMonthly / monthlyIncome) * 100

    const savingsPct  = Math.min(50, Math.max(10, Math.round(rawSavingsPct)))
    const emergencyPct = Math.max(5, Math.min(10, Math.round(10 - savingsPct * 0.2)))
    const remainingPct = 100 - savingsPct - emergencyPct
    const livingPct    = Math.max(30, Math.round(remainingPct * 0.80))
    const investmentPct = Math.max(0, 100 - livingPct - savingsPct - emergencyPct)

    return { livingPct, savingsPct, emergencyPct, investmentPct }
  },

  getAllocation(): AllocationPlan | null {
    return load<AllocationPlan | null>(KEYS.allocation, null)
  },

  saveAllocation(plan: AllocationPlan): AllocationPlan {
    save(KEYS.allocation, plan)
    return plan
  },
}
