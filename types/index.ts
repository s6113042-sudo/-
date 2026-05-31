// =============================================
// GoalFlow — 全域型別定義
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
  address:             string | null
  monthlyIncome:       number
  riskLevel:           RiskLevel
  dailyBudget:         number
  impulseCooldownHours: number
  onChainProfileId:    string | null
  isSubscribed:        boolean        // 訂閱狀態
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
  coolingOffUntilMs: number
  createdAt:     number
  progressPct:   number
  daysLeft:      number
  monthlyGap:    number
  onChainId:     string | null
}

export interface GoalAllocation {
  goalId:        string
  basisPoints:   number
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
  surplus:          number
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
  comment?:     string              // 使用者自訂註釋（平時隱藏，可選）
  timestampMs:  number
  goalId:       string | null
  txDigest:     string | null
  isImpulse:    boolean
  date:         string
}

// ─── 月曆 ────────────────────────────────────

export type DayStatus = 'positive' | 'negative' | 'neutral' | 'empty'

export interface DayRecord {
  date:         string
  totalIncome:  number
  totalExpense: number
  net:          number
  status:       DayStatus
  transactions: Transaction[]
  goalDeposits: { goalId: string; amount: number }[]
  targetMet:    boolean
}

export type CalendarData = Record<string, DayRecord>

export interface CategoryBreakdown {
  category: TxCategory
  label:    string
  amount:   number
  pct:      number
  color:    string
}

// ─── 獎勵 ────────────────────────────────────

export type AchievementType =
  | 'FIRST_LOGIN'        // 新手上路
  | 'FIRST_GOAL'         // 目標設定者
  | 'FIRST_TRANSACTION'  // 記帳達人
  | 'GOAL_COMPLETE'      // 時間管理師
  | 'SAVINGS_10000'      // 儲蓄冠軍
  | 'STREAK_100'         // 自律大師

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
  level:              number
  xp:                 number
  xpToNextLevel:      number
  points:             number
  streakDays:         number
  maxStreak:          number
  lastCheckinDay:     number
  totalCheckins:      number
  hasCheckedInToday:  boolean
  petStage:           PetStage
  petXp:              number
  badges:             AchievementType[]
  pendingCashback:    number
  // 每日記帳 XP 追蹤
  dailyTxXp:          number        // 當日已獲得的記帳 XP（上限 20）
  dailyTxDate:        string        // 當日日期 'YYYY-MM-DD'
  // 每週寶箱
  weeklyChestStreak:  number        // 本週連續天數 (0-7)
  usdcBalance:        number        // 累積 USDC 獎勵
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
  syncEnabled:     boolean
}

// ─── 固定支出 ─────────────────────────────────

export type RecurringFrequency = 'monthly' | 'weekly'

export interface RecurringExpense {
  id:           string
  name:         string
  emoji:        string
  amount:       number
  category:     TxCategory
  frequency:    RecurringFrequency
  dayOf:        number
  nextDueDate:  string
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
  estimatedApy: number
  riskLevel:   RiskLevel
  minAmount:   number
  description: string
  isActive:    boolean
}
