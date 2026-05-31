/**
 * GoalFlow API 層
 *
 * 設計原則：
 * - 前後端介面透過此檔案隔離
 * - NEXT_PUBLIC_USE_MOCK=true → localStorage mock 實作
 * - NEXT_PUBLIC_USE_MOCK=false → Sui 鏈上呼叫（lib/sui-client.ts）
 *
 * 換成真實後端只需替換各 service 的實作，Store 層完全不感知。
 */

import { format, startOfMonth, endOfMonth, eachDayOfInterval, addDays, addMonths, setDate, nextDay, type Day } from 'date-fns'
import type {
  Goal, Transaction, RewardAccount, AllocationPlan,
  GapAnalysis, DayRecord, CalendarData, CategoryBreakdown,
  AchievementType, TxCategory, RecurringExpense, RecurringFrequency,
} from '@/types'
import {
  ACHIEVEMENTS, TX_CATEGORIES, XP_PER_LEVEL,
  BASE_CHECKIN_XP, GOAL_COMPLETE_XP,
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
}

function todayDayIndex() { return Math.floor(Date.now() / 86400000) }

function calcPetStage(level: number): RewardAccount['petStage'] {
  if (level >= 20) return 'legend'
  if (level >= 10) return 'chicken'
  if (level >= 4)  return 'chick'
  return 'egg'
}

export const rewardService = {
  get(): RewardAccount {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    r.hasCheckedInToday = r.lastCheckinDay === todayDayIndex()
    r.xpToNextLevel     = r.level * XP_PER_LEVEL - r.xp
    r.petStage          = calcPetStage(r.level)
    return r
  },

  checkIn(): { xpEarned: number; pointsEarned: number; newStreak: number } {
    const r = load<RewardAccount>(KEYS.rewards, DEFAULT_REWARDS)
    const today = todayDayIndex()
    if (r.lastCheckinDay === today) throw new Error('已簽到')

    r.streakDays    = r.lastCheckinDay + 1 === today ? r.streakDays + 1 : 1
    r.maxStreak     = Math.max(r.maxStreak, r.streakDays)
    r.lastCheckinDay = today
    r.totalCheckins += 1

    let xp = BASE_CHECKIN_XP
    let pts = 5
    if (r.streakDays >= 100) { xp += 100; pts += 50; r.pendingCashback += 20 }
    else if (r.streakDays >= 30) { xp += 40; pts += 20; r.pendingCashback += 10 }
    else if (r.streakDays >= 7)  { xp += 15; pts += 10; r.pendingCashback += 3  }

    r.xp      += xp
    r.points  += pts
    r.petXp   += xp
    r.level    = Math.floor(r.xp / XP_PER_LEVEL) + 1
    r.petStage = calcPetStage(r.level)

    // 自動解鎖成就
    if (r.streakDays === 7)  rewardService._unlockBadge(r, 'STREAK_7')
    if (r.streakDays === 30) rewardService._unlockBadge(r, 'STREAK_30')
    if (r.petStage === 'chick'   && !r.badges.includes('PET_HATCH')) rewardService._unlockBadge(r, 'PET_HATCH')
    if (r.petStage === 'chicken' && !r.badges.includes('PET_GROW'))  rewardService._unlockBadge(r, 'PET_GROW')

    save(KEYS.rewards, r)
    return { xpEarned: xp, pointsEarned: pts, newStreak: r.streakDays }
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
    r.xp += amount
    r.petXp += amount
    r.level  = Math.floor(r.xp / XP_PER_LEVEL) + 1
    r.petStage = calcPetStage(r.level)
    save(KEYS.rewards, r)
  },
}

// ─── 分配 / Gap Analysis ──────────────────────

// ─── 固定支出 Service (Feature 2) ────────────────

function calcNextDueDate(frequency: RecurringFrequency, dayOf: number): string {
  const now = new Date()
  if (frequency === 'monthly') {
    let d = setDate(now, dayOf)
    if (d <= now) d = setDate(addMonths(now, 1), dayOf)
    return format(d, 'yyyy-MM-dd')
  } else {
    // weekly: dayOf is 0-6 (Sun=0)
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

  getAllocation(): AllocationPlan | null {
    return load<AllocationPlan | null>(KEYS.allocation, null)
  },

  saveAllocation(plan: AllocationPlan): AllocationPlan {
    save(KEYS.allocation, plan)
    return plan
  },
}
