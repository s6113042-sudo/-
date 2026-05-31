/**
 * GoalFlow — Sui 區塊鏈介面
 *
 * 此檔案是前端與 Sui Move 合約的橋接層。
 * 每個函式對應一個合約 entry function。
 *
 * 使用方式（實際接入時）：
 *   import { Transaction } from '@mysten/sui/transactions'
 *   import { useSuiClient, useSignAndExecuteTransaction } from '@mysten/dapp-kit-react'
 *
 * 目前狀態：介面已定義，實作為 stub（留待連接錢包後替換）
 */

import { GOALFLOW_PACKAGE_ID, NETWORK, RPC_URL } from './constants'

// ─── 合約模組路徑 ──────────────────────────────
const PKG  = GOALFLOW_PACKAGE_ID
const MOD_GOAL    = `${PKG}::goal_flow`
const MOD_REWARDS = `${PKG}::rewards`
const MOD_LEDGER  = `${PKG}::ledger`

// ─── 型別：交易建構回傳 ──────────────────────────
// 前端調用 signAndExecuteTransaction(tx) 送出
export interface SuiTxBlock {
  __kind: 'SuiTxBlock'
  // 實際使用時替換為 Transaction 物件
  moduleTarget: string
  args: unknown[]
}

function stub(fn: string, args: unknown[]): SuiTxBlock {
  console.info(`[SuiClient][STUB] ${fn}`, args)
  return { __kind: 'SuiTxBlock', moduleTarget: fn, args }
}

// ===============================
// goal_flow.move — 介面
// ===============================

export const suiGoalFlow = {
  /**
   * create_profile(monthly_income, risk_level, daily_budget, impulse_cooldown_ms, clock)
   * 前端呼叫時機：Onboarding 完成
   */
  createProfile(monthlyIncomeNT: number, riskLevel: 1|2|3, dailyBudgetNT: number, cooldownHours: number): SuiTxBlock {
    const mist = ntToMist(monthlyIncomeNT)
    return stub(`${MOD_GOAL}::create_profile`, [mist, riskLevel, ntToMist(dailyBudgetNT), cooldownHours * 3_600_000])
  },

  /**
   * create_goal(profile, name, emoji, color, target_amount, deadline_ms, category, clock)
   */
  createGoal(
    profileObjectId: string,
    name: string, emoji: string, color: string,
    targetNT: number, deadlineMs: number, category: number,
  ): SuiTxBlock {
    return stub(`${MOD_GOAL}::create_goal`, [profileObjectId, name, emoji, color, ntToMist(targetNT), deadlineMs, category])
  },

  /**
   * record_progress(goal, amount, clock) — 非鎖倉，僅記錄數字
   */
  recordProgress(goalObjectId: string, amountNT: number): SuiTxBlock {
    return stub(`${MOD_GOAL}::record_progress`, [goalObjectId, ntToMist(amountNT)])
  },

  /**
   * deposit_sui_to_goal(goal, payment, clock) — 真實鎖倉 SUI
   */
  depositSui(goalObjectId: string, amountMist: bigint): SuiTxBlock {
    return stub(`${MOD_GOAL}::deposit_sui_to_goal`, [goalObjectId, amountMist.toString()])
  },

  /**
   * set_cooling_off(goal, profile, clock)
   */
  setCoolingOff(goalObjectId: string, profileObjectId: string): SuiTxBlock {
    return stub(`${MOD_GOAL}::set_cooling_off`, [goalObjectId, profileObjectId])
  },

  /**
   * save_allocation_plan(income, emergency_bp, investment_bp, goal_ids, goal_bps, monthly_targets, defi_enabled, clock)
   */
  saveAllocationPlan(
    incomeNT: number,
    emergencyBp: number, investmentBp: number,
    goalIds: string[], goalBps: number[], monthlyTargets: number[],
    defiEnabled: boolean,
  ): SuiTxBlock {
    return stub(`${MOD_GOAL}::save_allocation_plan`, [
      ntToMist(incomeNT), emergencyBp, investmentBp,
      goalIds, goalBps, monthlyTargets.map(ntToMist), defiEnabled,
    ])
  },
}

// ===============================
// rewards.move — 介面
// ===============================

export const suiRewards = {
  /**
   * create_reward_account(clock)
   */
  createAccount(): SuiTxBlock {
    return stub(`${MOD_REWARDS}::create_reward_account`, [])
  },

  /**
   * daily_checkin(account, clock)
   */
  dailyCheckin(accountObjectId: string): SuiTxBlock {
    return stub(`${MOD_REWARDS}::daily_checkin`, [accountObjectId])
  },

  /**
   * claim_cashback(account)
   */
  claimCashback(accountObjectId: string): SuiTxBlock {
    return stub(`${MOD_REWARDS}::claim_cashback`, [accountObjectId])
  },

  /**
   * grant_achievement(account, achievement_type)
   */
  grantAchievement(accountObjectId: string, achievementType: number): SuiTxBlock {
    return stub(`${MOD_REWARDS}::grant_achievement`, [accountObjectId, achievementType])
  },
}

// ===============================
// ledger.move — 介面
// ===============================

export const suiLedger = {
  /**
   * create_ledger(clock)
   */
  createLedger(): SuiTxBlock {
    return stub(`${MOD_LEDGER}::create_ledger`, [])
  },

  /**
   * add_entry(ledger, amount, is_income, category, note, goal_id, is_impulse_checked, clock)
   */
  addEntry(
    ledgerObjectId: string,
    amountNT: number,
    isIncome: boolean,
    category: number,
    note: string,
    goalId: string | null,
    isImpulseChecked: boolean,
  ): SuiTxBlock {
    return stub(`${MOD_LEDGER}::add_entry`, [
      ledgerObjectId, ntToMist(amountNT), isIncome, category,
      note, goalId ?? '0x0', isImpulseChecked,
    ])
  },

  /**
   * delete_entry(ledger, entry_id)
   */
  deleteEntry(ledgerObjectId: string, entryId: number): SuiTxBlock {
    return stub(`${MOD_LEDGER}::delete_entry`, [ledgerObjectId, entryId])
  },

  /**
   * record_wallet_transaction(ledger, amount, is_income, category, note, tx_digest, clock)
   */
  recordWalletTx(
    ledgerObjectId: string,
    amountMist: bigint,
    isIncome: boolean,
    category: number,
    note: string,
    txDigest: string,
  ): SuiTxBlock {
    return stub(`${MOD_LEDGER}::record_wallet_transaction`, [
      ledgerObjectId, amountMist.toString(), isIncome, category, note, txDigest,
    ])
  },
}

// ===============================
// 工具函式
// ===============================

/** NT$ → MIST (1 NT$ ≈ 0.003 SUI，測試時用 1:1000 換算) */
function ntToMist(nt: number): bigint {
  return BigInt(nt) * BigInt(1_000_000)  // 1 NT$ = 1,000,000 MIST (stub)
}

/** MIST → NT$ */
export function mistToNt(mist: bigint): number {
  return Number(mist) / 1_000_000
}

/** 讀取 Sui 錢包餘額（stub） */
export async function fetchSuiBalance(address: string): Promise<bigint> {
  console.info(`[SuiClient] fetchSuiBalance(${address}) — stub`)
  return BigInt(1_000_000_000_000) // 1000 SUI for demo
}

/** 查詢物件（stub） */
export async function fetchObjects(address: string): Promise<{
  profileId: string | null
  rewardId: string | null
  ledgerId: string | null
}> {
  console.info(`[SuiClient] fetchObjects(${address}) — stub`)
  return { profileId: null, rewardId: null, ledgerId: null }
}

export const suiClient = { suiGoalFlow, suiRewards, suiLedger, fetchSuiBalance, fetchObjects }
export default suiClient
