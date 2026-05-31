// =============================================
// GoalFlow — 全域型別定義
// 與 Sui Move 合約結構對應，保持欄位命名一致
// =============================================

// ─── 列舉 ────────────────────────────────────

export type GoalCategory = 'savings' | 'investment' | 'emergency' | 'travel' | 'education' | 'other'
export type GoalStatus    = 'active' | 'completed' | 'cancelled' | 'paused'
export type RiskLevel     = 1 | 2 | 3   // 1=保守 2=穩健 3=積極
export type PetStage      = 'egg' | 'chick' | 'chicken' | 'legend'
export type TxCategory    =
  | 'salary' | 'investment_income' | 'bonus'          // 收入
  | 'food' | 'transport' | 'entertainment' | 'shopping'
  | 'health' | 'utilities' | 'goal_deposit' | 'impulse' | 'other_expense' // 支出

// ─── 使用者設定 ──────────────────────────────

export interface UserProfile {
  address:             string | null  // Sui 錢包地址
  monthlyIncome:       number         // NT$
  riskLevel:           RiskLevel
  dailyBudget:         number
  impulseCooldownHours: number        // 衝動冷靜期小時數
  onChainProfileId:    string | null  // Sui UserProfile Object ID
}

// ─── 目標 ────────────────────────────────────

export interface Goal {
  id:            string
  name:          string
  emoji:         string
  color:         string
  targetAmount:  number
  currentAmount: number
  deadlineMs:    number
  category:      GoalCategory
  status:        GoalStatus
  riskLevel:     RiskLevel
  coolingOffUntilMs: number          // 0 = 無冷靜期
  createdAt:     number
  // 前端衍生欄位（不存鏈上）
  progressPct:   number              // 0-100
  daysLeft:      number
  monthlyGap:    number              // 每月尚需金額
  onChainId:     string | null       // Sui Goal Object ID
}

export interface GoalAllocation {
  goalId:        string
  basisPoints:   number              // 10000 = 100%
  monthlyTarget: number
}

export interface AllocationPlan {
  monthlyIncome:         number
  emergencyBasisPoints:  number
  investmentBasisPoints: number
  goalEntries:           GoalAllocation[]
  defiEnabled:           boolean
}

// ─── 分配 Gap Analysis ───────────────────────

export interface GapAnalysis {
  monthlyIncome:    number
  totalMonthlyNeed: number
  surplus:          number           // 負數表示赤字
  isDeficit:        boolean
  goalBreakdown:    { goalId: string; name: string; monthlyNeed: number; pct: number }[]
  recommendations:  { goalId: string; name: string; suggestedCut: number }[]
}

// ─── 交易 ────────────────────────────────────

export interface Transaction {
  id:           string
  amount:       number
  isIncome:     boolean
  category:     TxCategory
  note:         string
  timestampMs:  number
  goalId:       string | null
  txDigest:     string | null        // Sui 鏈上 tx digest
  isImpulse:    boolean
  date:         string               // 'YYYY-MM-DD'（前端衍生）
}

// ─── 月曆 ────────────────────────────────────

export type DayStatus = 'positive' | 'negative' | 'neutral' | 'empty'

export interface DayRecord {
  date:         string               // 'YYYY-MM-DD'
  totalIncome:  number
  totalExpense: number
  net:          number
  status:       DayStatus
  transactions: Transaction[]
  goalDeposits: { goalId: string; amount: number }[]
  targetMet:    boolean              // net >= 0
}

export type CalendarData = Record<string, DayRecord>  // key: 'YYYY-MM-DD'

export interface CategoryBreakdown {
  category: TxCategory
  label:    string
  amount:   number
  pct:      number
  color:    string
}

// ─── 獎勵 ────────────────────────────────────

export type AchievementType =
  | 'FIRST_GOAL' | 'GOAL_COMPLETE' | 'STREAK_7' | 'STREAK_30'
  | 'BUDGET_MASTER' | 'DEFI_USER' | 'PET_HATCH' | 'PET_GROW'

export interface Achievement {
  type:        AchievementType
  label:       string
  description: string
  emoji:       string
  pointsReward: number
  isUnlocked:  boolean
  unlockedAt:  number | null
}

export interface RewardAccount {
  level:           number
  xp:              number
  xpToNextLevel:   number
  points:          number
  streakDays:      number
  maxStreak:       number
  lastCheckinDay:  number            // day index
  totalCheckins:   number
  hasCheckedInToday: boolean
  petStage:        PetStage
  petXp:           number
  badges:          AchievementType[]
  pendingCashback: number
}

// ─── 錢包 ────────────────────────────────────

export interface WalletState {
  isConnected:     boolean
  address:         string | null
  suiBalance:      number
  network:         'mainnet' | 'testnet' | 'devnet'
  profileObjectId: string | null
  rewardObjectId:  string | null
  ledgerObjectId:  string | null
  isInitialized:   boolean
  syncEnabled:     boolean           // Feature 1: 自動同步開關
}

// ─── 固定支出 (Feature 2) ─────────────────────

export type RecurringFrequency = 'monthly' | 'weekly'

export interface RecurringExpense {
  id:           string
  name:         string
  emoji:        string
  amount:       number
  category:     TxCategory
  frequency:    RecurringFrequency
  dayOf:        number              // monthly: 1-31, weekly: 0-6 (Sun-Sat)
  nextDueDate:  string              // 'YYYY-MM-DD'
  isActive:     boolean
  notes:        string
  createdAt:    number
}

// ─── App 全域狀態 ─────────────────────────────

export interface AppState {
  isOnboarded:       boolean
  profile:           UserProfile
  goals:             Goal[]
  allocation:        AllocationPlan | null
  transactions:      Transaction[]
  rewards:           RewardAccount
  wallet:            WalletState
  recurringExpenses: RecurringExpense[]
}

// ─── API 回應包裝 ─────────────────────────────

export interface ApiResult<T> {
  data:    T | null
  error:   string | null
  loading: boolean
}

// ─── DeFi ────────────────────────────────────

export interface DeFiProtocol {
  id:          string
  name:        string
  estimatedApy: number              // % 年化
  riskLevel:   RiskLevel
  minAmount:   number
  description: string
  isActive:    boolean
}
