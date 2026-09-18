import { useState } from 'react'
import { useAccount, useReadContract, useWriteContract, useWaitForTransactionReceipt, useChainId, useSwitchChain } from 'wagmi'
import { erc20Abi, parseUnits } from 'viem'
import { toast } from 'sonner'
import { ShoppingCart, Loader2, CheckCircle2, AlertCircle, Coins, ArrowLeftRight } from 'lucide-react'
import { MIPO_TOKEN, ARC_TESTNET_CHAIN_ID } from '@/contracts'
import { getUsdc } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'

export function BuyPanel() {
  const { address } = useAccount()
  const chainId = useChainId()
  const { switchChain, isPending: isSwitching } = useSwitchChain()
  const isWrongNetwork = !!address && chainId !== ARC_TESTNET_CHAIN_ID
  const [amount, setAmount] = useState('')
  const usdc = getUsdc(ARC_TESTNET_CHAIN_ID)
  const usdcDecimals = usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)

  // Read funding phase status
  const { data: fundingActive } = useReadContract({
    address: MIPO_TOKEN.address,
    abi: MIPO_TOKEN.abi,
    functionName: 'fundingPhaseActive',
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  // Read tokens remaining
  const { data: allocated } = useReadContract({
    address: MIPO_TOKEN.address,
    abi: MIPO_TOKEN.abi,
    functionName: 'publicSaleAllocated',
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  const { data: sold, refetch: refetchSold } = useReadContract({
    address: MIPO_TOKEN.address,
    abi: MIPO_TOKEN.abi,
    functionName: 'publicSaleSold',
    chainId: ARC_TESTNET_CHAIN_ID,
  })

  // Read USDC allowance
  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: usdc?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'allowance',
    args: address ? [address, MIPO_TOKEN.address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address && !!usdc },
  })

  // USDC balance
  const { data: usdcBalance, refetch: refetchUsdcBalance } = useReadContract({
    address: usdc?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address && !!usdc },
  })

  // Approve USDC
  const { writeContract: approveUsdc, data: approveHash, isPending: isApproving } = useWriteContract()
  const { isLoading: isApproveConfirming, isSuccess: isApproveSuccess } = useWaitForTransactionReceipt({
    hash: approveHash,
    onSuccess: () => { void refetchAllowance(); toast.success('USDC disetujui!') },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  // Buy tokens
  const { writeContract: buyTokens, data: buyHash, isPending: isBuying } = useWriteContract()
  const { isLoading: isBuyConfirming, isSuccess: isBuySuccess } = useWaitForTransactionReceipt({
    hash: buyHash,
    onSuccess: () => {
      void refetchSold()
      void refetchUsdcBalance()
      void refetchAllowance()
      setAmount('')
      toast.success('Token berhasil dibeli!')
    },
  } as Parameters<typeof useWaitForTransactionReceipt>[0])

  const tokenAmount = amount && !isNaN(Number(amount)) && Number(amount) > 0
    ? parseUnits(amount, 18)
    : 0n

  // Cost = amount tokens * 1 USDC each (price is 1e6 USDC per 1e18 token)
  const usdcCost = tokenAmount > 0n
    ? (tokenAmount * BigInt(1 * 10 ** usdcDecimals)) / BigInt(10 ** 18)
    : 0n

  const needsApproval = allowance !== undefined && usdcCost > 0n && (allowance) < usdcCost
  const remaining = allocated !== undefined && sold !== undefined
    ? Amount.fromRaw((allocated as bigint) - (sold as bigint), 18).toFixed(0)
    : '—'
  const soldPct = allocated !== undefined && sold !== undefined && (allocated as bigint) > 0n
    ? Number((sold as bigint) * 100n / (allocated as bigint))
    : 0

  const hasEnoughUsdc = usdcBalance !== undefined && usdcCost > 0n && (usdcBalance) >= usdcCost
  const canBuy = !!address && tokenAmount > 0n && !needsApproval && hasEnoughUsdc && !!fundingActive

  function handleApprove() {
    if (!usdc || !address) return
    approveUsdc({
      address: usdc.address as `0x${string}`,
      abi: erc20Abi,
      functionName: 'approve',
      args: [MIPO_TOKEN.address, usdcCost],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  function handleBuy() {
    if (tokenAmount <= 0n) return
    buyTokens({
      address: MIPO_TOKEN.address,
      abi: MIPO_TOKEN.abi,
      functionName: 'buyTokens',
      args: [tokenAmount],
      chainId: ARC_TESTNET_CHAIN_ID,
    })
  }

  if (!address) return null

  // Wrong network — show switch button
  if (isWrongNetwork) {
    return (
      <div className="rounded-2xl bg-white/60 border border-amber-200 backdrop-blur-sm p-4 space-y-3">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Beli Token MIPO</div>
        <div className="flex items-start gap-2 text-sm text-amber-700 bg-amber-50 rounded-xl px-3 py-2.5">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          <span>Wallet kamu terhubung ke network yang salah. Pindah ke Arc Testnet untuk melanjutkan.</span>
        </div>
        <button
          onClick={() => switchChain({ chainId: ARC_TESTNET_CHAIN_ID })}
          disabled={isSwitching}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isSwitching
            ? <><Loader2 size={15} className="animate-spin" /> Switching...</>
            : <><ArrowLeftRight size={15} /> Switch ke Arc Testnet</>}
        </button>
      </div>
    )
  }

  if (!fundingActive) {
    return (
      <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4">
        <div className="flex items-center gap-2 text-slate-500 text-sm">
          <AlertCircle size={16} />
          Funding phase telah berakhir.
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4 space-y-4">
      <div className="flex items-center justify-between">
        <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Beli Token MIPO</div>
        <div className="flex items-center gap-1 text-xs text-indigo-600 font-medium">
          <Coins size={12} />
          {remaining} tersisa
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-indigo-500 to-indigo-600 rounded-full transition-all duration-500"
            style={{ width: `${soldPct}%` }}
          />
        </div>
        <div className="flex justify-between text-[11px] text-slate-400">
          <span>{soldPct}% terjual</span>
          <span>Target 700,000 MIPO</span>
        </div>
      </div>

      {/* Input */}
      <div className="space-y-2">
        <div className="relative">
          <input
            type="number"
            min="1"
            step="1"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="Jumlah token (mis. 100)"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-medium">MIPO</span>
        </div>

        {/* Cost display */}
        {usdcCost > 0n && (
          <div className="flex items-center justify-between rounded-xl bg-indigo-50 border border-indigo-100 px-3 py-2">
            <span className="text-xs text-indigo-600">Total biaya</span>
            <span className="text-sm font-bold text-indigo-700">
              {Amount.fromRaw(usdcCost, usdcDecimals).toFixed(2)} USDC
            </span>
          </div>
        )}

        {/* Insufficient balance warning */}
        {usdcCost > 0n && usdcBalance !== undefined && (usdcBalance) < usdcCost && (
          <div className="flex items-center gap-2 text-xs text-red-500 bg-red-50 rounded-xl px-3 py-2">
            <AlertCircle size={13} />
            USDC tidak cukup. Saldo: ${Amount.fromRaw(usdcBalance, usdcDecimals).toFixed(2)}
          </div>
        )}
      </div>

      {/* Buttons */}
      <div className="space-y-2">
        {/* Step 1: Approve */}
        {needsApproval && (
          <button
            onClick={handleApprove}
            disabled={isApproving || isApproveConfirming || isBuySuccess}
            className="w-full rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
          >
            {isApproving || isApproveConfirming ? (
              <><Loader2 size={15} className="animate-spin" /> Menyetujui USDC...</>
            ) : isApproveSuccess ? (
              <><CheckCircle2 size={15} /> USDC Disetujui</>
            ) : (
              <>Step 1: Setujui USDC</>
            )}
          </button>
        )}

        {/* Step 2: Buy */}
        <button
          onClick={handleBuy}
          disabled={!canBuy || isBuying || isBuyConfirming}
          className="w-full rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-white font-semibold py-3 text-sm transition-colors flex items-center justify-center gap-2"
        >
          {isBuying || isBuyConfirming ? (
            <><Loader2 size={15} className="animate-spin" /> {isBuyConfirming ? 'Mengkonfirmasi...' : 'Mengirim...'}</>
          ) : isBuySuccess ? (
            <><CheckCircle2 size={15} /> Berhasil Dibeli!</>
          ) : (
            <><ShoppingCart size={15} /> {needsApproval ? 'Step 2: Beli Token' : 'Beli Token MIPO'}</>
          )}
        </button>
      </div>

      <p className="text-[11px] text-slate-400 text-center">
        Harga: 1 USDC / token · Setelah beli, stake di tab Staking untuk dapat dividen
      </p>
    </div>
  )
}
