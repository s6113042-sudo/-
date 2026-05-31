/**
 * Sui on-chain data fetching for the calendar.
 * Converts raw transaction blocks into per-day records
 * (income, expense, object changes) that merge with local data.
 */
import { SuiClient, getFullnodeUrl } from '@mysten/sui/client'

export type OnChainTxEntry = {
  digest:         string
  timestampMs:    number
  suiIn:          number   // SUI received (converted from MIST)
  suiOut:         number   // SUI sent
  gasFee:         number
  objectsCreated: number
  objectsMutated: number
  objectsDeleted: number
  objectDetails:  { type: string; changeType: string; objectId: string }[]
}

export type OnChainDayRecord = {
  date:      string
  suiIn:     number
  suiOut:    number
  txCount:   number
  entries:   OnChainTxEntry[]
}

const MIST = 1_000_000_000   // 1 SUI = 1e9 MIST
const SUI_COIN_TYPE = '0x2::sui::SUI'

function mistsToSui(mists: string | number): number {
  return Number(BigInt(mists)) / MIST
}

function shortenType(fullType: string): string {
  // e.g. "0x2::coin::Coin<0x2::sui::SUI>" → "Coin<SUI>"
  return fullType.replace(/0x[a-f0-9]+::/g, '')
}

/** Fetch all transaction blocks for an address in a given month */
export async function fetchMonthOnChainData(
  address:  string,
  year:     number,
  month:    number,
  network:  'mainnet' | 'testnet' = 'testnet',
): Promise<Record<string, OnChainDayRecord>> {
  const client = new SuiClient({ url: getFullnodeUrl(network) })

  const startMs = new Date(year, month - 1, 1).getTime()
  const endMs   = new Date(year, month, 0, 23, 59, 59, 999).getTime()

  // Fetch up to 100 most recent txs (covers most months)
  const { data } = await client.queryTransactionBlocks({
    filter:  { FromOrToAddress: { addr: address } },
    options: {
      showBalanceChanges: true,
      showObjectChanges:  true,
      showInput:          true,
    },
    limit: 100,
    order: 'descending',
  })

  const dayMap: Record<string, OnChainDayRecord> = {}

  for (const tx of data) {
    const ts = Number(tx.timestampMs ?? 0)
    if (!ts || ts < startMs || ts > endMs) continue

    const date = new Date(ts).toISOString().slice(0, 10)
    if (!dayMap[date]) {
      dayMap[date] = { date, suiIn: 0, suiOut: 0, txCount: 0, entries: [] }
    }

    const day = dayMap[date]
    day.txCount++

    // ── Balance changes (SUI only) ──
    let suiIn = 0, suiOut = 0
    for (const ch of tx.balanceChanges ?? []) {
      if (ch.coinType !== SUI_COIN_TYPE) continue
      const owner = typeof ch.owner === 'object' && 'AddressOwner' in ch.owner
        ? ch.owner.AddressOwner
        : null
      if (owner !== address) continue
      const delta = BigInt(ch.amount)
      if (delta > 0n) suiIn  += Number(delta) / MIST
      else            suiOut += Math.abs(Number(delta)) / MIST
    }
    day.suiIn  += suiIn
    day.suiOut += suiOut

    // ── Gas fee ──
    const gasFee = tx.effects?.gasUsed
      ? mistsToSui(
          (Number(tx.effects.gasUsed.computationCost) +
           Number(tx.effects.gasUsed.storageCost) -
           Number(tx.effects.gasUsed.storageRebate))
          .toString()
        )
      : 0

    // ── Object changes ──
    const objectDetails: OnChainTxEntry['objectDetails'] = []
    let objectsCreated = 0, objectsMutated = 0, objectsDeleted = 0

    for (const oc of tx.objectChanges ?? []) {
      const changeType = oc.type
      const objectId   = 'objectId' in oc ? oc.objectId : ''
      const rawType    = 'objectType' in oc && oc.objectType ? String(oc.objectType) : changeType
      const shortType  = shortenType(rawType)

      objectDetails.push({ type: shortType, changeType, objectId })

      if (changeType === 'created')   objectsCreated++
      else if (changeType === 'mutated')  objectsMutated++
      else if (changeType === 'deleted')  objectsDeleted++
    }

    day.entries.push({
      digest: tx.digest,
      timestampMs: ts,
      suiIn, suiOut, gasFee,
      objectsCreated, objectsMutated, objectsDeleted,
      objectDetails,
    })
  }

  return dayMap
}
