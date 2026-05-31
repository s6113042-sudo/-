import type { TxCategory, GoalCategory, AchievementType } from '@/types'

// ─── 合約設定 ─────────────────────────────────
export const GOALFLOW_PACKAGE_ID = '0x0000000000000000000000000000000000000000000000000000000000000000'
export const NETWORK: 'testnet' | 'mainnet' | 'devnet' = 'testnet'
export const RPC_URL = `https://fullnode.${NETWORK}.sui.io:443`

// ─── 寵物設定 ─────────────────────────────────
// egg→lv1  chick(破殼)→lv3  chicken(小雞)→lv6  legend(雄雞)→lv10
export const PET_STAGES = {
  egg:     { emoji: '🥚', label: '存錢蛋',   minLevel: 1  },
  chick:   { emoji: '🐣', label: '破殼新芽', minLevel: 3  },
  chicken: { emoji: '🐥', label: '理財小雞', minLevel: 6  },
  legend:  { emoji: '🐓', label: '財富雄雞', minLevel: 10 },
} as const

// ─── 成就定義（6 個）─────────────────────────
export const ACHIEVEMENTS: Record<AchievementType, {
  label: string; description: string; emoji: string; pointsReward: number
}> = {
  FIRST_LOGIN:       { label: '新手上路',   description: '第一次登入',     emoji: '🌱', pointsReward: 10  },
  FIRST_GOAL:        { label: '目標設定者', description: '第一次設定目標', emoji: '🎯', pointsReward: 30  },
  FIRST_TRANSACTION: { label: '記帳達人',   description: '第一次記帳',     emoji: '📝', pointsReward: 20  },
  GOAL_COMPLETE:     { label: '時間管理師', description: '完成一個目標',   emoji: '⏰', pointsReward: 50  },
  SAVINGS_10000:     { label: '儲蓄冠軍',   description: '累積存款 10,000',emoji: '💰', pointsReward: 80  },
  STREAK_100:        { label: '自律大師',   description: '連續登入 100 天',emoji: '🏆', pointsReward: 200 },
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
export const XP_PER_LEVEL    = 200   // 第 1 級所需，之後每級 +50
export const BASE_CHECKIN_XP = 0     // 簽到本身不給 XP（由記帳事件給）
export const GOAL_COMPLETE_XP = 0    // 由 store 動態決定（<10000→+10, >=10000→+25）

/**
 * 計算等級資訊
 * 第 1 級需 200 XP，之後每級 +50
 */
export function calcLevelInfo(totalXp: number): {
  level: number
  xpInLevel: number    // 本級已累積
  xpForLevel: number   // 本級共需
} {
  let level = 1
  let cumXp = 0
  for (;;) {
    const needed = 200 + (level - 1) * 50
    if (cumXp + needed > totalXp) {
      return { level, xpInLevel: totalXp - cumXp, xpForLevel: needed }
    }
    cumXp += needed
    level++
  }
}
