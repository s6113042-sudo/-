import type { TxCategory, GoalCategory, AchievementType } from '@/types'

// ─── 合約設定（換成真實部署後替換） ────────────────
export const GOALFLOW_PACKAGE_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const NETWORK: 'testnet' | 'mainnet' | 'devnet' = 'testnet'
export const RPC_URL = `https://fullnode.${NETWORK}.sui.io:443`

// ─── 寵物設定 ─────────────────────────────────
export const PET_STAGES = {
  egg:     { emoji: '🥚', label: '蛋寶寶',    minLevel: 0  },
  chick:   { emoji: '🐣', label: '小理財家',   minLevel: 4  },
  chicken: { emoji: '🐥', label: '忠實存款者', minLevel: 10 },
  legend:  { emoji: '🐔', label: '理財傳說',   minLevel: 20 },
} as const

// ─── 成就定義 ─────────────────────────────────
export const ACHIEVEMENTS: Record<AchievementType, {
  label: string; description: string; emoji: string; pointsReward: number
}> = {
  FIRST_GOAL:    { label: '目標達人',   description: '建立第一個財務目標',  emoji: '🎯', pointsReward: 30  },
  GOAL_COMPLETE: { label: '達成成就',   description: '完成任一目標',        emoji: '🏆', pointsReward: 100 },
  STREAK_7:      { label: '週週在線',   description: '連續簽到 7 天',       emoji: '🔥', pointsReward: 50  },
  STREAK_30:     { label: '月度勤奮',   description: '連續簽到 30 天',      emoji: '⭐', pointsReward: 200 },
  BUDGET_MASTER: { label: '預算大師',   description: '連續 7 天不超支',     emoji: '💹', pointsReward: 80  },
  DEFI_USER:     { label: 'DeFi 先鋒', description: '首次啟用 DeFi 配置',  emoji: '🌐', pointsReward: 60  },
  PET_HATCH:     { label: '蛋孵化了',   description: '寵物進化至第 2 階段', emoji: '🐣', pointsReward: 40  },
  PET_GROW:      { label: '羽翼豐滿',   description: '寵物進化至第 3 階段', emoji: '🐥', pointsReward: 80  },
}

// ─── 交易分類 ─────────────────────────────────
export const TX_CATEGORIES: Record<TxCategory, {
  label: string; color: string; isIncome: boolean; emoji: string
}> = {
  salary:            { label: '薪資',   color: '#22c55e', isIncome: true,  emoji: '💼' },
  investment_income: { label: '投資收益', color: '#14b8a6', isIncome: true,  emoji: '📈' },
  bonus:             { label: '獎金',   color: '#84cc16', isIncome: true,  emoji: '🎁' },
  food:              { label: '餐飲',   color: '#f97316', isIncome: false, emoji: '🍜' },
  transport:         { label: '交通',   color: '#3b82f6', isIncome: false, emoji: '🚗' },
  entertainment:     { label: '娛樂',   color: '#8b5cf6', isIncome: false, emoji: '🎮' },
  shopping:          { label: '購物',   color: '#ec4899', isIncome: false, emoji: '🛍️' },
  health:            { label: '醫療',   color: '#06b6d4', isIncome: false, emoji: '🏥' },
  utilities:         { label: '帳單',   color: '#64748b', isIncome: false, emoji: '💡' },
  goal_deposit:      { label: '目標存款', color: '#22c55e', isIncome: false, emoji: '🎯' },
  impulse:           { label: '衝動消費', color: '#ef4444', isIncome: false, emoji: '⚠️' },
  other_expense:     { label: '其他',   color: '#94a3b8', isIncome: false, emoji: '📦' },
}

// ─── 目標分類 ─────────────────────────────────
export const GOAL_CATEGORIES: Record<GoalCategory, { label: string; emoji: string }> = {
  savings:    { label: '一般儲蓄', emoji: '💰' },
  investment: { label: '投資',   emoji: '📈' },
  emergency:  { label: '緊急備用金', emoji: '🛡️' },
  travel:     { label: '旅遊',   emoji: '✈️' },
  education:  { label: '教育',   emoji: '🎓' },
  other:      { label: '其他',   emoji: '🎯' },
}

// ─── 調色板 ────────────────────────────────────
export const GOAL_COLORS = [
  '#22c55e', '#14b8a6', '#3b82f6', '#8b5cf6',
  '#f59e0b', '#ec4899', '#f97316', '#06b6d4',
]

export const GOAL_EMOJIS = [
  '✈️','🏠','🎓','🚗','💻','📱','🎮','💍',
  '🌏','🏋️','🎨','📚','🏖️','💊','🎯','🚀',
]

// ─── DeFi 協議 ────────────────────────────────
export const DEFI_PROTOCOLS = [
  { id: 'scallop', name: 'Scallop',   estimatedApy: 4.2, riskLevel: 1 as const, minAmount: 10,  description: '穩定幣借貸，低風險穩定收益' },
  { id: 'navi',    name: 'NAVI',      estimatedApy: 8.5, riskLevel: 2 as const, minAmount: 50,  description: 'SUI 藍籌資產流動性挖礦' },
  { id: 'cetus',   name: 'Cetus',     estimatedApy: 22,  riskLevel: 3 as const, minAmount: 100, description: 'AMM 流動性提供，高收益高風險' },
]

// ─── XP 設定 ──────────────────────────────────
export const XP_PER_LEVEL  = 200
export const BASE_CHECKIN_XP = 10
export const GOAL_COMPLETE_XP = 150
