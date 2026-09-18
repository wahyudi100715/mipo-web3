import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useSwitchChain } from 'wagmi'
import { erc20Abi, parseUnits } from 'viem'
import { toast } from 'sonner'
import { motion } from 'framer-motion'
import { ShieldCheck, CheckCircle2, Loader2, AlertCircle, ChevronDown, ChevronUp, PlusCircle, Layers } from 'lucide-react'
import { MIPO_DIVIDEND, MIPO_STAKING, ARC_TESTNET_CHAIN_ID, PLATFORM_WALLET } from '@/contracts'
import { getUsdc } from '@/onchain-facts'
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
}

function formatDate(ts: bigint) {
  if (ts === 0n) return '—'
  return new Date(Number(ts) * 1000).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
}

export function AdminPanel() {
  const { address, chainId } = useAccount()
  const { switchChain } = useSwitchChain()
  const usdc = getUsdc(ARC_TESTNET_CHAIN_ID)
  const usdcDecimals = usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)
  const isWrongChain = address && chainId !== ARC_TESTNET_CHAIN_ID

  const [profitInput, setProfitInput] = useState('')
  const [stakerList, setStakerList] = useState('')
  const [expanded, setExpanded] = useState<number | null>(null)

  const { data: currentPeriodId, refetch: refetchPeriod } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'currentPeriodId',
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { refetchInterval: 10_000 },
  })

  const periodId = (currentPeriodId as bigint | undefined) ?? 0n

  const { data: period, refetch: refetchPeriodInfo } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'periodInfo',
    args: [periodId],
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { refetchInterval: 10_000 },
  })

  const { data: totalStaked } = useReadContract({
    address: MIPO_STAKING.address,
    abi: MIPO_STAKING.abi,
    functionName: 'totalStaked',
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { refetchInterval: 10_000 },
  })

  // USDC allowance for dividend contract
  const profitBn = profitInput ? parseUnits(profitInput, usdcDecimals) : 0n
  const { data: usdcAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdc?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, MIPO_DIVIDEND.address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address && !!usdc },
  })

  const needsUsdcApproval = profitBn > 0n && (usdcAllowance as bigint ?? 0n) < profitBn

  // submitProfit
  const { writeContract: submitProfit, data: submitHash, isPending: isSubmitting } = useWriteContract()
  const { isLoading: isSubmitConfirming, isSuccess: isSubmitSuccess } = useWaitForTransactionReceipt({
    hash: submitHash,
    onSuccess: () => { void refetchPeriodInfo(); toast.success('Profit submitted!') },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // confirmProfit
  const { writeContract: confirmProfit, data: confirmHash, isPending: isConfirming } = useWriteContract()
  const { isLoading: isConfirmTxLoading, isSuccess: isConfirmSuccess } = useWaitForTransactionReceipt({
    hash: confirmHash,
    onSuccess: () => { void refetchPeriodInfo(); toast.success('Profit confirmed!') },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // approve USDC for dividend contract
  const { writeContract: approveUsdc, data: approveHash, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming } = useWaitForTransactionReceipt({
    hash: approveHash,
    onSuccess: () => { void refetchAllowance(); toast.success('USDC approved!') },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // distributeDividend
  const { writeContract: distribute, data: distHash, isPending: isDistributing } = useWriteContract()
  const { isLoading: isDistConfirming, isSuccess: isDistSuccess } = useWaitForTransactionReceipt({
    hash: distHash,
    onSuccess: () => { void refetchPeriodInfo(); toast.success('Dividend distributed!') },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // finalizePeriod
  const { writeContract: finalize, data: finalHash, isPending: isFinalizing } = useWriteContract()
  const { isLoading: isFinalConfirming } = useWaitForTransactionReceipt({
    hash: finalHash,
    onSuccess: () => { void refetchPeriodInfo(); toast.success('Period finalized!') },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // advancePeriod
  const { writeContract: advancePeriod, data: advHash, isPending: isAdvancing } = useWriteContract()
  const { isLoading: isAdvConfirming, isSuccess: isAdvSuccess } = useWaitForTransactionReceipt({
    hash: advHash,
    onSuccess: () => { void refetchPeriod(); void refetchPeriodInfo(); toast.success('Periode baru dibuat!') },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  const p = period as Period | undefined

  if (!address) return null

  const isOwner = address.toLowerCase() === PLATFORM_WALLET.toLowerCase()
  if (!isOwner) return null

  function handleApproveUsdc() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    approveUsdc({
      address: usdc!.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [MIPO_DIVIDEND.address, profitBn],
    })
  }

  function handleSubmit() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    if (!profitBn) return
    submitProfit({
      address: MIPO_DIVIDEND.address,
      abi: MIPO_DIVIDEND.abi,
      functionName: 'submitProfit',
      args: [periodId, profitBn],
    })
  }

  function handleConfirm() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    confirmProfit({
      address: MIPO_DIVIDEND.address,
      abi: MIPO_DIVIDEND.abi,
      functionName: 'confirmProfit',
      args: [periodId],
    })
  }

  function handleDistribute() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    const addrs = stakerList
      .split(/[\n,]/)
      .map((s) => s.trim())
      .filter((s) => s.startsWith('0x') && s.length === 42) as `0x${string}`[]
    if (addrs.length === 0) { toast.error('Masukkan minimal 1 alamat staker yang valid'); return }
    distribute({
      address: MIPO_DIVIDEND.address,
      abi: MIPO_DIVIDEND.abi,
      functionName: 'distributeDividend',
      args: [periodId, addrs],
    })
  }

  function handleFinalize() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    finalize({
      address: MIPO_DIVIDEND.address,
      abi: MIPO_DIVIDEND.abi,
      functionName: 'finalizePeriod',
      args: [periodId],
    })
  }

  function handleAdvance() {
    if (isWrongChain) { switchChain({ chainId: ARC_TESTNET_CHAIN_ID }); return }
    advancePeriod({
      address: MIPO_DIVIDEND.address,
      abi: MIPO_DIVIDEND.abi,
      functionName: 'advancePeriod',
      args: [],
    })
  }

  const stepDone = (flag: boolean) => flag
    ? <CheckCircle2 size={14} className="text-emerald-500" />
    : <div className="w-3.5 h-3.5 rounded-full border-2 border-slate-300" />

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      <div className="flex items-center gap-2 px-1">
        <ShieldCheck size={15} className="text-indigo-500" />
        <span className="text-sm font-bold text-slate-700">Admin Panel</span>
        <span className="text-xs bg-indigo-100 text-indigo-600 font-semibold px-2 py-0.5 rounded-full">Owner</span>
      </div>

      {isWrongChain && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3 text-xs text-amber-700">
          <AlertCircle size={13} />
          <span>Switch ke Arc Testnet untuk mengirim transaksi.</span>
          <button
            onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
            className="ml-auto bg-amber-500 text-white px-2 py-1 rounded-lg font-semibold"
          >Switch</button>
        </div>
      )}

      {/* Current period status */}
      <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">
            Periode {Number(periodId)} — Status
          </div>
          <button onClick={() => setExpanded(expanded === 0 ? null : 0)} className="text-slate-400 hover:text-slate-600">
            {expanded === 0 ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
          </button>
        </div>

        <div className="flex gap-4 text-xs">
          <div className="flex items-center gap-1.5">
            {stepDone(p?.submitted ?? false)}
            <span className={p?.submitted ? 'text-slate-800 font-medium' : 'text-slate-400'}>Profit disubmit</span>
          </div>
          <div className="flex items-center gap-1.5">
            {stepDone(p?.confirmed ?? false)}
            <span className={p?.confirmed ? 'text-slate-800 font-medium' : 'text-slate-400'}>Dikonfirmasi</span>
          </div>
          <div className="flex items-center gap-1.5">
            {stepDone(p?.distributed ?? false)}
            <span className={p?.distributed ? 'text-slate-800 font-medium' : 'text-slate-400'}>Didistribusi</span>
          </div>
        </div>

        {p && (
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div>Mulai: <span className="text-slate-700">{formatDate(p.startTime)}</span></div>
            <div>Selesai: <span className="text-slate-700">{formatDate(p.endTime)}</span></div>
            {p.profitAmount > 0n && (
              <div>Profit: <span className="text-slate-700 font-bold">${Amount.fromRaw(p.profitAmount, usdcDecimals).toFixed(2)}</span></div>
            )}
            <div>Total staked: <span className="text-slate-700">{totalStaked ? Amount.fromRaw(totalStaked as bigint, 18).toFixed(0) : '—'} MIPO</span></div>
          </div>
        )}
      </div>

      {/* Step 1: Submit Profit */}
      {!(p?.submitted) && (
        <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Langkah 1 — Submit Profit</div>
          <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5">
            <span className="text-slate-500 text-sm">$</span>
            <input
              type="number"
              placeholder="0.00"
              value={profitInput}
              onChange={(e) => setProfitInput(e.target.value)}
              className="flex-1 bg-transparent text-lg font-bold text-slate-900 outline-none tabular-nums placeholder:text-slate-300"
            />
            <span className="text-sm font-semibold text-slate-500">USDC</span>
          </div>
          {needsUsdcApproval ? (
            <button
              onClick={handleApproveUsdc}
              disabled={isApproving || isApproveConfirming || !profitInput}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isApproving || isApproveConfirming
                ? <><Loader2 size={14} className="animate-spin" />Approving...</>
                : 'Approve USDC'}
            </button>
          ) : (
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || isSubmitConfirming || !profitInput}
              className="w-full py-3 rounded-xl bg-indigo-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isSubmitting || isSubmitConfirming
                ? <><Loader2 size={14} className="animate-spin" />{isSubmitConfirming ? 'Mengonfirmasi...' : 'Konfirmasi di wallet...'}</>
                : 'Submit Profit'}
            </button>
          )}
          {isSubmitSuccess && submitHash && (
            <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, submitHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 underline flex items-center gap-1">
              <CheckCircle2 size={11} /> Tx confirmed
            </a>
          )}
        </div>
      )}

      {/* Step 2: Confirm Profit */}
      {p?.submitted && !p.confirmed && (
        <div className="rounded-2xl bg-white/60 border border-amber-300/40 backdrop-blur-sm p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-amber-600">Langkah 2 — Konfirmasi Profit</div>
          <div className="text-sm text-slate-600">
            Profit <strong>${Amount.fromRaw(p.profitAmount, usdcDecimals).toFixed(2)} USDC</strong> untuk periode ini sudah disubmit.
            Klik konfirmasi sebagai langkah verifikasi kedua.
          </div>
          <button
            onClick={handleConfirm}
            disabled={isConfirming || isConfirmTxLoading}
            className="w-full py-3 rounded-xl bg-amber-500 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isConfirming || isConfirmTxLoading
              ? <><Loader2 size={14} className="animate-spin" />{isConfirmTxLoading ? 'Mengonfirmasi...' : 'Konfirmasi di wallet...'}</>
              : <><ShieldCheck size={14} />Konfirmasi Profit</>}
          </button>
          {isConfirmSuccess && confirmHash && (
            <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, confirmHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 underline flex items-center gap-1">
              <CheckCircle2 size={11} /> Tx confirmed
            </a>
          )}
        </div>
      )}

      {/* Step 3: Distribute */}
      {p?.confirmed && !p.distributed && (
        <div className="rounded-2xl bg-white/60 border border-emerald-300/40 backdrop-blur-sm p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-emerald-700">Langkah 3 — Distribusi Dividen</div>
          <div className="text-xs text-slate-500">
            Masukkan alamat staker (satu per baris atau pisahkan dengan koma). Maks 500 per batch. Panggil beberapa kali jika staker lebih dari 500.
          </div>
          <textarea
            rows={4}
            placeholder="0xabc...\n0xdef..."
            value={stakerList}
            onChange={(e) => setStakerList(e.target.value)}
            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-mono text-slate-700 outline-none resize-none placeholder:text-slate-300"
          />
          <button
            onClick={handleDistribute}
            disabled={isDistributing || isDistConfirming || !stakerList.trim()}
            className="w-full py-3 rounded-xl bg-emerald-600 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isDistributing || isDistConfirming
              ? <><Loader2 size={14} className="animate-spin" />{isDistConfirming ? 'Mengonfirmasi...' : 'Konfirmasi di wallet...'}</>
              : <><Layers size={14} />Distribusi Batch</>}
          </button>

          {p.distributedAt > 0n && (
            <button
              onClick={handleFinalize}
              disabled={isFinalizing || isFinalConfirming}
              className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isFinalizing || isFinalConfirming
                ? <><Loader2 size={14} className="animate-spin" />{isFinalConfirming ? 'Mengonfirmasi...' : 'Konfirmasi di wallet...'}</>
                : <><CheckCircle2 size={14} />Finalize Periode</>}
            </button>
          )}

          {isDistSuccess && distHash && (
            <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, distHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 underline flex items-center gap-1">
              <CheckCircle2 size={11} /> Distribusi batch berhasil
            </a>
          )}
        </div>
      )}

      {/* Advance period */}
      {p?.distributed && (
        <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Periode Berikutnya</div>
          <div className="text-sm text-slate-500">Periode {Number(periodId)} sudah selesai. Buat periode baru untuk siklus berikutnya.</div>
          <button
            onClick={handleAdvance}
            disabled={isAdvancing || isAdvConfirming}
            className="w-full py-3 rounded-xl bg-slate-800 text-white font-semibold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {isAdvancing || isAdvConfirming
              ? <><Loader2 size={14} className="animate-spin" />{isAdvConfirming ? 'Mengonfirmasi...' : 'Konfirmasi di wallet...'}</>
              : <><PlusCircle size={14} />Buat Periode Baru</>}
          </button>
          {isAdvSuccess && advHash && (
            <a href={buildTxExplorerUrl(ARC_TESTNET_CHAIN_ID, advHash)} target="_blank" rel="noopener noreferrer" className="text-xs text-indigo-500 underline flex items-center gap-1">
              <CheckCircle2 size={11} /> Periode baru dibuat
            </a>
          )}
        </div>
      )}

      {/* Emergency pause */}
      <EmergencyControls isWrongChain={!!isWrongChain} switchChain={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })} />
    </motion.div>
  )
}

function EmergencyControls({ isWrongChain, switchChain: doSwitch }: { isWrongChain: boolean; switchChain: () => void }) {
  const { writeContract: pauseStaking, isPending: isPausingStake } = useWriteContract()
  const { writeContract: pauseDividend, isPending: isPausingDiv } = useWriteContract()
  const [show, setShow] = useState(false)

  return (
    <div className="rounded-2xl border border-red-200/60 bg-red-50/40 backdrop-blur-sm p-4 space-y-3">
      <button onClick={() => setShow(!show)} className="flex items-center justify-between w-full text-xs font-semibold uppercase tracking-widest text-red-600">
        <span>Emergency Controls</span>
        {show ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
      </button>
      {show && (
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => {
              if (isWrongChain) { doSwitch(); return }
              pauseStaking({
                address: MIPO_STAKING.address,
                abi: MIPO_STAKING.abi,
                functionName: 'emergencyPause',
                args: [],
              })
            }}
            disabled={isPausingStake}
            className="py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isPausingStake ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
            Pause Staking
          </button>
          <button
            onClick={() => {
              if (isWrongChain) { doSwitch(); return }
              pauseDividend({
                address: MIPO_DIVIDEND.address,
                abi: MIPO_DIVIDEND.abi,
                functionName: 'pause',
                args: [],
              })
            }}
            disabled={isPausingDiv}
            className="py-2.5 rounded-xl bg-red-600 text-white text-xs font-semibold flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            {isPausingDiv ? <Loader2 size={12} className="animate-spin" /> : <AlertCircle size={12} />}
            Pause Dividend
          </button>
        </div>
      )}
    </div>
  )
}
