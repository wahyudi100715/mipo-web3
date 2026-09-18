import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { Gift, CheckCircle2, Loader2, AlertCircle, Clock, CircleDollarSign } from 'lucide-react'

import { MIPO_DIVIDEND, ARC_TESTNET_CHAIN_ID } from '@/contracts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { buildTxExplorerUrl } from '@/onchain-facts'

type Period = {
  id: bigint
  startTime: bigint
  endTime: bigint
  profitAmount: bigint
  submitted: boolean
  confirmed: boolean
  distributed: boolean
  totalStakedSnapshot: bigint
  distributedAt: bigint
  finalized?: boolean
}

function PeriodStatusBadge({ p }: { p: Period }) {
  if (p.distributed) {
    return <span className="text-xs bg-emerald-100 text-emerald-700 font-semibold px-2 py-0.5 rounded-full">Distributed</span>
  }
  if (p.confirmed) {
    return <span className="text-xs bg-blue-100 text-blue-700 font-semibold px-2 py-0.5 rounded-full">Confirmed</span>
  }
  if (p.submitted) {
    return <span className="text-xs bg-amber-100 text-amber-700 font-semibold px-2 py-0.5 rounded-full">Submitted</span>
  }
  return <span className="text-xs bg-slate-100 text-slate-500 font-semibold px-2 py-0.5 rounded-full">Pending</span>
}

function formatDate(ts: bigint) {
  if (ts === 0n) return '—'
  return new Date(Number(ts) * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

function PeriodRow({
  periodId,
  address,
  onClaimed,
}: {
  periodId: number
  address: `0x${string}`
  onClaimed: () => void
}) {
  const usdcDecimals = usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)
  const { chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const isWrongChain = chainId !== ARC_TESTNET_CHAIN_ID

  const { data: period } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'periodInfo',
    args: [BigInt(periodId)],
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const { data: claimable, refetch: refetchClaimable } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'claimableAmount',
    args: [address, BigInt(periodId)],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { refetchInterval: 8_000 },
  })

  const { data: claimed } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'hasClaimedPeriod',
    args: [address, BigInt(periodId)],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { refetchInterval: 8_000 },
  })

  const { writeContract, data: claimHash, isPending } = useWriteContract()
  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: claimHash,
    onSuccess: () => {
      void refetchClaimable()
      onClaimed()
      toast.success(`Dividen periode ${periodId} berhasil diklaim!`)
    },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  if (!period) return null

  const p = period as unknown as Period
  const claimableAmt = (claimable as bigint | undefined) ?? 0n
  const hasClaimed = claimed as boolean | undefined

  // Only show periods that are at least submitted
  if (!p.submitted && !p.distributed) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-slate-200/60 bg-white/50 p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-800">Periode {periodId}</span>
            <PeriodStatusBadge p={p} />
          </div>
          <div className="text-xs text-slate-400 mt-0.5">
            {formatDate(p.startTime)} – {formatDate(p.endTime)}
          </div>
        </div>
        {p.profitAmount > 0n && (
          <div className="text-right shrink-0">
            <div className="text-xs text-slate-400">Profit</div>
            <div className="text-sm font-bold text-slate-800 tabular-nums">
              ${Amount.fromRaw(p.profitAmount, usdcDecimals).toFixed(2)}
            </div>
          </div>
        )}
      </div>

      {p.distributed && (
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <CircleDollarSign size={12} />
            <span>Bagian kamu:</span>
            <span className={`font-bold tabular-nums ${claimableAmt > 0n ? 'text-emerald-600' : 'text-slate-400'}`}>
              {hasClaimed ? 'Sudah diklaim' : claimableAmt > 0n
                ? `$${Amount.fromRaw(claimableAmt, usdcDecimals).toFixed(6)}`
                : '$0.00'}
            </span>
          </div>

          {!hasClaimed && claimableAmt > 0n && (
            isWrongChain ? (
              <button
                onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
                className="text-xs bg-amber-500 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1"
              >
                <AlertCircle size={11} /> Switch Chain
              </button>
            ) : (
              <button
                onClick={() => writeContract({
                  address: MIPO_DIVIDEND.address,
                  abi: MIPO_DIVIDEND.abi,
                  functionName: 'claimDividend',
                  args: [BigInt(periodId)],
                })}
                disabled={isPending || isConfirming}
                className="text-xs bg-indigo-600 text-white font-semibold px-3 py-1.5 rounded-lg flex items-center gap-1.5 disabled:opacity-50"
              >
                {isPending || isConfirming
                  ? <><Loader2 size={11} className="animate-spin" />{isConfirming ? 'Konfirmasi...' : 'Wallet...'}</>
                  : <><Gift size={11} />Klaim</>}
              </button>
            )
          )}

          {hasClaimed && (
            <span className="text-xs text-emerald-600 flex items-center gap-1">
              <CheckCircle2 size={12} /> Diklaim
            </span>
          )}
        </div>
      )}

      {p.distributed && !p.distributed && (
        <div className="flex items-center gap-1.5 text-xs text-slate-400">
          <Clock size={11} />
          <span>Menunggu distribusi dari admin</span>
        </div>
      )}

      {isSuccess && claimHash && (
        <a
          href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, claimHash)}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-indigo-500 underline flex items-center gap-1"
        >
          <CheckCircle2 size={11} /> Tx confirmed — lihat di explorer
        </a>
      )}
    </motion.div>
  )
}

export function DividendPanel() {
  const { address } = useAccount()
  const usdcDecimals = usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)

  const { data: currentPeriodId, refetch: refetchPeriodId } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'currentPeriodId',
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { refetchInterval: 15_000 },
  })

  const { data: allClaimable, refetch: refetchClaimable } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'allClaimableForUser',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  const { data: totalClaimed } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'totalClaimed',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  const periodCount = currentPeriodId !== undefined ? Number(currentPeriodId) + 1 : 0
  const allClaimableAmt = (allClaimable as bigint | undefined) ?? 0n
  const totalClaimedAmt = (totalClaimed as bigint | undefined) ?? 0n

  function handleClaimed() {
    void refetchClaimable()
    void refetchPeriodId()
  }

  if (!address) {
    return (
      <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-6 text-center text-slate-400 text-sm">
        Connect your wallet to view dividends.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Ringkasan Dividen</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <div className="text-xs text-slate-400">Total Bisa Diklaim</div>
            <div className={`text-xl font-bold tabular-nums ${allClaimableAmt > 0n ? 'text-emerald-600' : 'text-slate-700'}`}>
              ${Amount.fromRaw(allClaimableAmt, usdcDecimals).toFixed(4)}
            </div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Total Diklaim</div>
            <div className="text-xl font-bold tabular-nums text-slate-700">
              ${Amount.fromRaw(totalClaimedAmt, usdcDecimals).toFixed(4)}
            </div>
          </div>
        </div>
      </div>

      {/* Period list */}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 px-1">
          Periode Dividen ({periodCount} total)
        </div>

        {periodCount === 0 ? (
          <div className="rounded-xl bg-white/50 border border-slate-200/60 p-6 text-center text-slate-400 text-sm">
            Belum ada periode dividen.
          </div>
        ) : (
          Array.from({ length: periodCount }, (_, i) => periodCount - 1 - i).map((pid) => (
            <PeriodRow
              key={pid}
              periodId={pid}
              address={address}
              onClaimed={handleClaimed}
            />
          ))
        )}
      </div>

      <p className="text-xs text-slate-400 text-center px-2">
        Dividen dibayar dalam USDC ke wallet kamu. Hanya staker yang mulai stake sebelum periode dimulai yang berhak menerima dividen.
      </p>
    </div>
  )
}
