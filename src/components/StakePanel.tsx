import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi, parseUnits, formatUnits } from 'viem'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { Lock, Unlock, Clock, AlertCircle, CheckCircle2, Loader2, Info } from 'lucide-react'
import { MIPO_TOKEN, MIPO_STAKING, ARC_TESTNET_CHAIN_ID } from '@/contracts'

import { buildTxExplorerUrl } from '@/onchain-facts'

function formatDuration(seconds: bigint) {
  const s = Number(seconds)
  if (s <= 0) return 'Unlocked'
  const days = Math.floor(s / 86400)
  const hours = Math.floor((s % 86400) / 3600)
  if (days > 0) return `${days}d ${hours}h remaining`
  const mins = Math.floor((s % 3600) / 60)
  return `${hours}h ${mins}m remaining`
}

function formatTimestamp(ts: bigint) {
  if (ts === 0n) return '—'
  return new Date(Number(ts) * 1000).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export function StakePanel() {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const [stakeAmount, setStakeAmount] = useState('')
  const [unstakeAmount, setUnstakeAmount] = useState('')
  const [tab, setTab] = useState<'stake' | 'unstake'>('stake')

  const isWrongChain = address && chainId !== ARC_TESTNET_CHAIN_ID

  // Read staked info
  const { data: stakeInfo, refetch: refetchStakeInfo } = useReadContract({
    address: MIPO_STAKING.address,
    abi: MIPO_STAKING.abi,
    functionName: 'stakeInfo',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  const { data: timeUntilUnlock } = useReadContract({
    address: MIPO_STAKING.address,
    abi: MIPO_STAKING.abi,
    functionName: 'timeUntilUnlock',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  // Read MIPO balance
  const { data: mipoBalance, refetch: refetchBalance } = useReadContract({
    address: MIPO_TOKEN.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address, refetchInterval: 10_000 },
  })

  // Read allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: MIPO_TOKEN.address,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, MIPO_STAKING.address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address },
  })

  // Approve
  const { writeContract: approve, data: approveTxHash, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveTxHash,
    onSuccess: () => {
      void refetchAllowance()
      toast.success('Approval confirmed!')
    },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // Stake
  const { writeContract: stake, data: stakeTxHash, isPending: isStaking } = useWriteContract()
  const { isLoading: isStakeConfirming, isSuccess: isStakeSuccess } = useWaitForTransactionReceipt({
    hash: stakeTxHash,
    onSuccess: () => {
      void refetchStakeInfo()
      void refetchBalance()
      setStakeAmount('')
      toast.success('Stake confirmed!')
    },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // Unstake
  const { writeContract: unstake, data: unstakeTxHash, isPending: isUnstaking } = useWriteContract()
  const { isLoading: isUnstakeConfirming, isSuccess: isUnstakeSuccess } = useWaitForTransactionReceipt({
    hash: unstakeTxHash,
    onSuccess: () => {
      void refetchStakeInfo()
      void refetchBalance()
      setUnstakeAmount('')
      toast.success('Unstake confirmed!')
    },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // Derived values
  const stakedTuple = stakeInfo as readonly [bigint, bigint, bigint, bigint, boolean] | undefined
  const stakedAmt = stakedTuple?.[0] ?? 0n
  const lockExpiry = stakedTuple?.[1] ?? 0n
  const firstStakedAt = stakedTuple?.[3] ?? 0n
  const unlocked = stakedTuple?.[4] ?? false
  const timeLeft = (timeUntilUnlock as bigint | undefined) ?? 0n

  const stakeAmountBn = stakeAmount ? parseUnits(stakeAmount, 18) : 0n
  const unstakeAmountBn = unstakeAmount ? parseUnits(unstakeAmount, 18) : 0n
  const needsApproval = stakeAmountBn > 0n && (allowance as bigint ?? 0n) < stakeAmountBn

  const stakeFee = stakeAmountBn > 0n ? (stakeAmountBn * 100n) / 10000n : 0n
  const netStake = stakeAmountBn - stakeFee
  const unstakeFee = unstakeAmountBn > 0n ? (unstakeAmountBn * 50n) / 10000n : 0n
  const netUnstake = unstakeAmountBn - unstakeFee

  function handleApprove() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    approve({
      address: MIPO_TOKEN.address,
      abi: erc20Abi,
      functionName: 'approve',
      args: [MIPO_STAKING.address, stakeAmountBn],
    })
  }

  function handleStake() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    if (!stakeAmountBn || stakeAmountBn === 0n) return
    stake({
      address: MIPO_STAKING.address,
      abi: MIPO_STAKING.abi,
      functionName: 'stake',
      args: [stakeAmountBn],
    })
  }

  function handleUnstake() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    if (!unstakeAmountBn || unstakeAmountBn === 0n) return
    unstake({
      address: MIPO_STAKING.address,
      abi: MIPO_STAKING.abi,
      functionName: 'unstake',
      args: [unstakeAmountBn],
    })
  }

  if (!address) {
    return (
      <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-6 text-center text-slate-400 text-sm">
        Connect your wallet to stake MIPO tokens.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Current stake info card */}
      {stakedAmt > 0n && (
        <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Your Stake</div>
          <div className="flex items-end gap-2">
            <span className="text-3xl font-bold tabular-nums text-slate-900">
              {parseFloat(formatUnits(stakedAmt, 18)).toLocaleString('id-ID', { maximumFractionDigits: 2 })}
            </span>
            <span className="text-slate-500 mb-1">MIPO</span>
          </div>
          <div className="flex flex-wrap gap-3 text-xs text-slate-500">
            <div className="flex items-center gap-1">
              {unlocked ? (
                <><Unlock size={12} className="text-emerald-500" /><span className="text-emerald-600 font-medium">Unlocked</span></>
              ) : (
                <><Clock size={12} /><span>{formatDuration(timeLeft)}</span></>
              )}
            </div>
            <div className="flex items-center gap-1">
              <span>Unlock: {formatTimestamp(lockExpiry)}</span>
            </div>
            {firstStakedAt > 0n && (
              <div className="flex items-center gap-1">
                <span>First stake: {formatTimestamp(firstStakedAt)}</span>
              </div>
            )}
          </div>
          {!unlocked && timeLeft > 0n && (
            <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
              <div
                className="bg-indigo-500 h-1.5 rounded-full transition-all"
                style={{
                  width: `${Math.max(0, Math.min(100, 100 - (Number(timeLeft) / (90 * 86400)) * 100))}%`,
                }}
              />
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm overflow-hidden">
        <div className="flex border-b border-slate-200/60">
          {(['stake', 'unstake'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex-1 py-3 text-sm font-semibold capitalize transition-colors ${
                tab === t
                  ? 'bg-white text-slate-900 border-b-2 border-indigo-500'
                  : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              {t === 'stake' ? <span className="flex items-center justify-center gap-1.5"><Lock size={13} />Stake</span>
                             : <span className="flex items-center justify-center gap-1.5"><Unlock size={13} />Unstake</span>}
            </button>
          ))}
        </div>

        <div className="p-4 space-y-4">
          <AnimatePresence mode="wait">
            {tab === 'stake' ? (
              <motion.div
                key="stake"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {/* Amount input */}
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-xs text-slate-500 font-medium">Amount to stake</label>
                    <button
                      className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                      onClick={() => setStakeAmount(formatUnits(mipoBalance as bigint ?? 0n, 18))}
                    >
                      Max: {parseFloat(formatUnits(mipoBalance as bigint ?? 0n, 18)).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MIPO
                    </button>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                    <input
                      type="number"
                      placeholder="0.00"
                      value={stakeAmount}
                      onChange={(e) => setStakeAmount(e.target.value)}
                      className="flex-1 bg-transparent text-lg font-bold text-slate-900 outline-none tabular-nums placeholder:text-slate-300"
                    />
                    <span className="text-sm font-semibold text-slate-500">MIPO</span>
                  </div>
                </div>

                {/* Fee preview */}
                {stakeAmountBn > 0n && (
                  <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1.5 text-xs text-slate-500">
                    <div className="flex justify-between">
                      <span>Stake fee (1%)</span>
                      <span className="text-slate-700 font-medium tabular-nums">-{parseFloat(formatUnits(stakeFee, 18)).toFixed(4)} MIPO</span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200 pt-1.5">
                      <span>Net staked</span>
                      <span className="text-slate-900 font-bold tabular-nums">{parseFloat(formatUnits(netStake, 18)).toFixed(4)} MIPO</span>
                    </div>
                    <div className="flex items-center gap-1 text-amber-600 mt-1">
                      <Info size={10} />
                      <span>Locked for 90 days from stake date</span>
                    </div>
                  </div>
                )}

                {/* CTA */}
                {isWrongChain ? (
                  <button
                    onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
                    className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm flex items-center justify-center gap-2"
                  >
                    <AlertCircle size={15} /> Switch to Arc Testnet
                  </button>
                ) : needsApproval ? (
                  <button
                    onClick={handleApprove}
                    disabled={isApproving || isApproveConfirming || !stakeAmount}
                    className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isApproving || isApproveConfirming ? <><Loader2 size={15} className="animate-spin" />{isApproveConfirming ? 'Confirming...' : 'Confirm in wallet...'}</> : 'Approve MIPO'}
                  </button>
                ) : (
                  <button
                    onClick={handleStake}
                    disabled={isStaking || isStakeConfirming || !stakeAmount || stakeAmountBn === 0n}
                    className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isStaking || isStakeConfirming
                      ? <><Loader2 size={15} className="animate-spin" />{isStakeConfirming ? 'Confirming...' : 'Confirm in wallet...'}</>
                      : <><Lock size={15} />Stake MIPO</>}
                  </button>
                )}

                {isStakeSuccess && stakeTxHash && (
                  <div className="flex items-center gap-2 text-xs text-emerald-600">
                    <CheckCircle2 size={13} />
                    <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, stakeTxHash)} target="_blank" rel="noopener noreferrer" className="underline">
                      Tx confirmed — view on explorer
                    </a>
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key="unstake"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
                className="space-y-3"
              >
                {stakedAmt === 0n ? (
                  <p className="text-sm text-slate-400 text-center py-4">You have no staked tokens.</p>
                ) : !unlocked ? (
                  <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
                    <Clock size={13} className="mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold">Lock period active</p>
                      <p>{formatDuration(timeLeft)} — unlock date: {formatTimestamp(lockExpiry)}</p>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <label className="text-xs text-slate-500 font-medium">Amount to unstake</label>
                        <button
                          className="text-xs text-indigo-500 hover:text-indigo-700 font-medium"
                          onClick={() => setUnstakeAmount(formatUnits(stakedAmt, 18))}
                        >
                          Max: {parseFloat(formatUnits(stakedAmt, 18)).toLocaleString('id-ID', { maximumFractionDigits: 2 })} MIPO
                        </button>
                      </div>
                      <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
                        <input
                          type="number"
                          placeholder="0.00"
                          value={unstakeAmount}
                          onChange={(e) => setUnstakeAmount(e.target.value)}
                          className="flex-1 bg-transparent text-lg font-bold text-slate-900 outline-none tabular-nums placeholder:text-slate-300"
                        />
                        <span className="text-sm font-semibold text-slate-500">MIPO</span>
                      </div>
                    </div>

                    {unstakeAmountBn > 0n && (
                      <div className="bg-slate-50 rounded-xl px-3 py-2.5 space-y-1.5 text-xs text-slate-500">
                        <div className="flex justify-between">
                          <span>Unstake fee (0.5%)</span>
                          <span className="text-slate-700 font-medium tabular-nums">-{parseFloat(formatUnits(unstakeFee, 18)).toFixed(4)} MIPO</span>
                        </div>
                        <div className="flex justify-between border-t border-slate-200 pt-1.5">
                          <span>You receive</span>
                          <span className="text-slate-900 font-bold tabular-nums">{parseFloat(formatUnits(netUnstake, 18)).toFixed(4)} MIPO</span>
                        </div>
                      </div>
                    )}

                    <button
                      onClick={handleUnstake}
                      disabled={isUnstaking || isUnstakeConfirming || !unstakeAmount || unstakeAmountBn === 0n}
                      className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isUnstaking || isUnstakeConfirming
                        ? <><Loader2 size={15} className="animate-spin" />{isUnstakeConfirming ? 'Confirming...' : 'Confirm in wallet...'}</>
                        : <><Unlock size={15} />Unstake MIPO</>}
                    </button>

                    {isUnstakeSuccess && unstakeTxHash && (
                      <div className="flex items-center gap-2 text-xs text-emerald-600">
                        <CheckCircle2 size={13} />
                        <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, unstakeTxHash)} target="_blank" rel="noopener noreferrer" className="underline">
                          Tx confirmed — view on explorer
                        </a>
                      </div>
                    )}
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  )
}
