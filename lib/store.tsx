'use client'

import { createContext, useContext, useReducer, useEffect, useRef, type ReactNode } from 'react'
import type { AppState, Goal, Transaction, AchievementType, RecurringExpense } from '@/types'
import { goalService, txService, rewardService, financeService, recurringService } from './api'
import { format } from 'date-fns'

// ─── 台灣時區當日 index (Feature 4: 00:00 台灣時間重置) ──
function twDayIndex() {
  return Math.floor((Date.now() + 8 * 3600_000) / 86_400_000)
}

// ─── 初始狀態 ─────────────────────────────────

const initRewards: AppState['rewards'] = {
  level: 1, xp: 0, xpToNextLevel: 200, points: 0,
  streakDays: 0, maxStreak: 0, lastCheckinDay: 0, totalCheckins: 0,
  hasCheckedInToday: false, petStage: 'egg', petXp: 0,
  badges: [], pendingCashback: 0,
}

const initWallet: AppState['wallet'] = {
  isConnected: false, address: null, suiBalance: 0,
  network: 'testnet', profileObjectId: null, rewardObjectId: null,
  ledgerObjectId: null, isInitialized: false,
  syncEnabled: false,  // Feature 1
}

const initProfile: AppState['profile'] = {
  address: null, monthlyIncome: 0, riskLevel: 2,
  dailyBudget: 3000, impulseCooldownHours: 24, onChainProfileId: null,
}

const INIT: AppState = {
  isOnboarded: false,
  profile: initProfile,
  goals: [],
  allocation: null,
  transactions: [],
  rewards: initRewards,
  wallet: initWallet,
  recurringExpenses: [],    // Feature 2
}

// ─── Actions ──────────────────────────────────

export type Action =
  | { type: 'HYDRATE'; payload: Partial<AppState> }
  | { type: 'ONBOARD'; payload: { monthlyIncome: number; riskLevel: 1|2|3; dailyBudget: number; impulseCooldownHours: number } }
  | { type: 'SET_GOALS'; payload: Goal[] }
  | { type: 'ADD_GOAL'; payload: Goal }
  | { type: 'UPDATE_GOAL'; payload: Goal }
  | { type: 'DELETE_GOAL'; payload: string }
  | { type: 'SET_TRANSACTIONS'; payload: Transaction[] }
  | { type: 'ADD_TRANSACTION'; payload: Transaction }
  | { type: 'DELETE_TRANSACTION'; payload: string }
  | { type: 'SET_REWARDS'; payload: AppState['rewards'] }
  | { type: 'UNLOCK_BADGE'; payload: AchievementType }
  | { type: 'SET_WALLET'; payload: Partial<AppState['wallet']> }
  | { type: 'SET_ALLOCATION'; payload: AppState['allocation'] }
  | { type: 'SET_PROFILE'; payload: Partial<AppState['profile']> }
  | { type: 'SET_RECURRING'; payload: RecurringExpense[] }
  | { type: 'ADD_RECURRING'; payload: RecurringExpense }
  | { type: 'DELETE_RECURRING'; payload: string }

// ─── Reducer ──────────────────────────────────

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...state, ...action.payload }
    case 'ONBOARD':
      return {
        ...state,
        isOnboarded: true,
        profile: { ...state.profile, ...action.payload },
      }
    case 'SET_GOALS':      return { ...state, goals: action.payload }
    case 'ADD_GOAL':       return { ...state, goals: [...state.goals, action.payload] }
    case 'UPDATE_GOAL':    return { ...state, goals: state.goals.map(g => g.id === action.payload.id ? action.payload : g) }
    case 'DELETE_GOAL':    return { ...state, goals: state.goals.filter(g => g.id !== action.payload) }
    case 'SET_TRANSACTIONS': return { ...state, transactions: action.payload }
    case 'ADD_TRANSACTION':  return { ...state, transactions: [action.payload, ...state.transactions] }
    case 'DELETE_TRANSACTION': return { ...state, transactions: state.transactions.filter(t => t.id !== action.payload) }
    case 'SET_REWARDS':    return { ...state, rewards: action.payload }
    case 'UNLOCK_BADGE':   return {
      ...state,
      rewards: {
        ...state.rewards,
        badges: state.rewards.badges.includes(action.payload)
          ? state.rewards.badges
          : [...state.rewards.badges, action.payload],
      },
    }
    case 'SET_WALLET':     return { ...state, wallet: { ...state.wallet, ...action.payload } }
    case 'SET_ALLOCATION': return { ...state, allocation: action.payload }
    case 'SET_PROFILE':    return { ...state, profile: { ...state.profile, ...action.payload } }
    case 'SET_RECURRING':  return { ...state, recurringExpenses: action.payload }
    case 'ADD_RECURRING':  return { ...state, recurringExpenses: [...state.recurringExpenses, action.payload] }
    case 'DELETE_RECURRING': return { ...state, recurringExpenses: state.recurringExpenses.filter(r => r.id !== action.payload) }
    default: return state
  }
}

// ─── Context ──────────────────────────────────

export interface SpendingAlert {
  goalName: string
  setbackDays: number
  excess: number
}

interface Ctx {
  state: AppState
  dispatch: React.Dispatch<Action>
  actions: {
    onboard(data: { monthlyIncome: number; riskLevel: 1|2|3; dailyBudget: number; impulseCooldownHours: number }): void
    // Goals — Feature 4: max 3
    createGoal(data: Parameters<typeof goalService.create>[0]): Goal | null
    deleteGoal(id: string): void
    addProgress(goalId: string, amount: number): void
    // Transactions
    addTransaction(data: Parameters<typeof txService.add>[0]): Transaction
    deleteTransaction(id: string): void
    // Feature 3: spending alert calculation
    calcSpendingAlert(amount: number, isIncome: boolean): SpendingAlert | null
    // Rewards — Feature 4: Taiwan timezone check-in
    checkIn(): Promise<{ xpEarned: number; pointsEarned: number; newStreak: number }>
    claimCashback(): number
    unlockBadge(type: AchievementType): void
    // Wallet — Feature 1
    connectWallet(address: string): void
    disconnectWallet(): void
    toggleWalletSync(): void
    simulateWalletIncome(amount: number): void
    simulateWalletExpense(amount: number): void
    // Allocation
    saveAllocation(plan: AppState['allocation']): void
    // Recurring — Feature 2
    addRecurring(data: Parameters<typeof recurringService.add>[0]): RecurringExpense
    deleteRecurring(id: string): void
  }
}

const AppCtx = createContext<Ctx | null>(null)

// ─── Provider ─────────────────────────────────

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, INIT)
  const syncIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // 從 localStorage 水化狀態
  useEffect(() => {
    try {
      const raw = localStorage.getItem('gf_app_state')
      const saved = raw ? JSON.parse(raw) as Partial<AppState> : {}
      const rewards = rewardService.get()
      // Feature 4: 修正 hasCheckedInToday 用台灣時間
      rewards.hasCheckedInToday = rewards.lastCheckinDay === twDayIndex()
      dispatch({
        type: 'HYDRATE',
        payload: {
          ...INIT,
          ...saved,
          goals:             goalService.getAll(),
          transactions:      txService.getAll(),
          rewards,
          allocation:        financeService.getAllocation(),
          recurringExpenses: recurringService.getAll(),
          wallet:            { ...INIT.wallet, ...(saved.wallet ?? {}), syncEnabled: false },
        },
      })
    } catch {}
  }, [])

  // 持久化設定
  useEffect(() => {
    if (!state.isOnboarded) return
    try {
      localStorage.setItem('gf_app_state', JSON.stringify({
        isOnboarded: state.isOnboarded,
        profile: state.profile,
        wallet: { ...state.wallet, syncEnabled: false },
      }))
    } catch {}
  }, [state.isOnboarded, state.profile, state.wallet])

  // Feature 1: 錢包自動同步 interval
  useEffect(() => {
    if (state.wallet.syncEnabled && state.wallet.isConnected) {
      syncIntervalRef.current = setInterval(() => {
        // Mock: 30% 機率模擬一筆隨機小額支出
        if (Math.random() < 0.3) {
          const cats = ['food', 'transport', 'utilities'] as const
          const cat  = cats[Math.floor(Math.random() * cats.length)]
          const amt  = Math.floor(Math.random() * 200) + 50
          const tx = txService.add({
            amount: amt, isIncome: false, category: cat,
            note: `[錢包同步] ${cat}`, timestampMs: Date.now(),
            goalId: null, txDigest: `0x${crypto.randomUUID().replace(/-/g, '')}`, isImpulse: false,
          })
          dispatch({ type: 'ADD_TRANSACTION', payload: tx })
          rewardService.awardXp(2)
          dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
        }
      }, 30_000)
    } else {
      if (syncIntervalRef.current) {
        clearInterval(syncIntervalRef.current)
        syncIntervalRef.current = null
      }
    }
    return () => {
      if (syncIntervalRef.current) clearInterval(syncIntervalRef.current)
    }
  }, [state.wallet.syncEnabled, state.wallet.isConnected])

  const actions: Ctx['actions'] = {
    onboard(data) {
      dispatch({ type: 'ONBOARD', payload: data })
      dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
    },

    // Feature 4: max 3 active goals
    createGoal(data) {
      const activeCount = state.goals.filter(g => g.status === 'active').length
      if (activeCount >= 3) return null
      const g = goalService.create(data)
      dispatch({ type: 'ADD_GOAL', payload: g })
      rewardService.unlockBadge('FIRST_GOAL')
      dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
      return g
    },

    deleteGoal(id) {
      goalService.delete(id)
      dispatch({ type: 'DELETE_GOAL', payload: id })
    },

    addProgress(goalId, amount) {
      const g = goalService.addProgress(goalId, amount)
      dispatch({ type: 'UPDATE_GOAL', payload: g })
      if (g.status === 'completed') {
        rewardService.unlockBadge('GOAL_COMPLETE')
        rewardService.awardXp(150)
        dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
      }
    },

    addTransaction(data) {
      const tx = txService.add(data)
      dispatch({ type: 'ADD_TRANSACTION', payload: tx })
      rewardService.awardXp(3)
      dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
      return tx
    },

    deleteTransaction(id) {
      txService.delete(id)
      dispatch({ type: 'DELETE_TRANSACTION', payload: id })
    },

    // Feature 3: 計算此消費使目標退後幾天
    calcSpendingAlert(amount, isIncome) {
      if (isIncome || amount <= 0) return null
      const todayStr   = format(new Date(), 'yyyy-MM-dd')
      const todaySpent = state.transactions
        .filter(t => t.date === todayStr && !t.isIncome)
        .reduce((s, t) => s + t.amount, 0)
      const newTotal  = todaySpent + amount
      if (newTotal <= state.profile.dailyBudget) return null
      const excess    = newTotal - state.profile.dailyBudget
      const primary   = state.goals.find(g => g.status === 'active' && g.monthlyGap > 0)
      if (!primary) return null
      const dailyRate = primary.monthlyGap / 30
      if (dailyRate <= 0) return null
      const setbackDays = Math.max(1, Math.round(excess / dailyRate))
      return { goalName: primary.name, setbackDays, excess }
    },

    // Feature 4: 台灣時間簽到，每日 00:00 重置
    async checkIn() {
      const today = twDayIndex()
      const r = rewardService.get()
      if (r.lastCheckinDay === today) throw new Error('今日已簽到')
      const result = rewardService.checkIn()
      dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
      return result
    },

    claimCashback() {
      const pts = rewardService.claimCashback()
      dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
      return pts
    },

    unlockBadge(type) {
      rewardService.unlockBadge(type)
      dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
    },

    // Feature 1: 錢包連接 / 斷線 / 同步切換
    connectWallet(address) {
      dispatch({ type: 'SET_WALLET', payload: { isConnected: true, address } })
    },

    disconnectWallet() {
      dispatch({ type: 'SET_WALLET', payload: { isConnected: false, address: null, syncEnabled: false } })
    },

    toggleWalletSync() {
      dispatch({ type: 'SET_WALLET', payload: { syncEnabled: !state.wallet.syncEnabled } })
    },

    simulateWalletIncome(amount) {
      const tx = txService.add({
        amount, isIncome: true, category: 'salary',
        note: '[錢包同步] 收款', timestampMs: Date.now(),
        goalId: null, txDigest: `0x${crypto.randomUUID().replace(/-/g, '')}`, isImpulse: false,
      })
      dispatch({ type: 'ADD_TRANSACTION', payload: tx })
    },

    simulateWalletExpense(amount) {
      const tx = txService.add({
        amount, isIncome: false, category: 'other_expense',
        note: '[錢包同步] 付款', timestampMs: Date.now(),
        goalId: null, txDigest: `0x${crypto.randomUUID().replace(/-/g, '')}`, isImpulse: false,
      })
      dispatch({ type: 'ADD_TRANSACTION', payload: tx })
      rewardService.awardXp(2)
      dispatch({ type: 'SET_REWARDS', payload: rewardService.get() })
    },

    saveAllocation(plan) {
      if (plan) financeService.saveAllocation(plan)
      dispatch({ type: 'SET_ALLOCATION', payload: plan })
    },

    // Feature 2: 固定支出
    addRecurring(data) {
      const item = recurringService.add(data)
      dispatch({ type: 'ADD_RECURRING', payload: item })
      return item
    },

    deleteRecurring(id) {
      recurringService.delete(id)
      dispatch({ type: 'DELETE_RECURRING', payload: id })
    },
  }

  return <AppCtx.Provider value={{ state, dispatch, actions }}>{children}</AppCtx.Provider>
}

export function useApp() {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
