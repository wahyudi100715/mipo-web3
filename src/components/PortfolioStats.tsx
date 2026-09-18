import { useAccount, useReadContract } from 'wagmi'
import { erc20Abi } from 'viem'
import { MIPO_TOKEN, MIPO_STAKING, MIPO_DIVIDEND, ARC_TESTNET_CHAIN_ID } from '@/contracts'
import { getUsdc } from '@/onchain-facts'
import { Amount, usdcDecimalsFor } from '@/onchain-money'
import { TrendingUp, Layers, Gift, CircleDollarSign } from 'lucide-react'

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = false,
}: {
  label: string
  value: string
  sub?: string
  icon: React.ElementType
  accent?: boolean
}) {
  return (
    <div className={`rounded-2xl p-4 flex flex-col gap-2 ${accent ? 'bg-navy-900/80 border border-indigo-500/30' : 'bg-white/60 border border-slate-200/60'} backdrop-blur-sm`}>
      <div className="flex items-center gap-2">
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${accent ? 'bg-indigo-500/20' : 'bg-slate-100'}`}>
          <Icon size={16} className={accent ? 'text-indigo-400' : 'text-slate-500'} />
        </div>
        <span className={`text-xs font-semibold uppercase tracking-widest ${accent ? 'text-indigo-300' : 'text-slate-500'}`}>{label}</span>
      </div>
      <div className={`text-2xl font-bold tabular-nums tracking-tight ${accent ? 'text-white' : 'text-slate-900'}`}>{value}</div>
      {sub && <div className={`text-xs ${accent ? 'text-indigo-300' : 'text-slate-400'}`}>{sub}</div>}
    </div>
  )
}

export function PortfolioStats() {
  const { address } = useAccount()
  const usdc = getUsdc(ARC_TESTNET_CHAIN_ID)
  const usdcDecimals = usdcDecimalsFor(ARC_TESTNET_CHAIN_ID)

  const { data: mipoBalance } = useReadContract({
    address: MIPO_TOKEN.address,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address },
  })

  const { data: stakeData } = useReadContract({
    address: MIPO_STAKING.address,
    abi: MIPO_STAKING.abi,
    functionName: 'stakeInfo',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address },
  })

  const { data: allClaimable } = useReadContract({
    address: MIPO_DIVIDEND.address,
    abi: MIPO_DIVIDEND.abi,
    functionName: 'allClaimableForUser',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address },
  })

  const { data: usdcBalance } = useReadContract({
    address: usdc?.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: ARC_TESTNET_CHAIN_ID,
    query: { enabled: !!address && !!usdc },
  })

  const formatMipo = (val: bigint | undefined) => {
    if (val === undefined) return '—'
    return Amount.fromRaw(val, 18).toFixed(2)
  }

  const formatUsdc = (val: bigint | undefined) => {
    if (val === undefined) return '—'
    return `$${Amount.fromRaw(val, usdcDecimals).toFixed(2)}`
  }

  // stakeInfo returns tuple: [amount, expiry, stakedAt, firstStakedAt, unlocked]
  const stakedAmount = stakeData ? (stakeData as readonly [bigint, bigint, bigint, bigint, boolean])[0] : undefined

  if (!address) {
    return (
      <div className="text-center py-8 text-slate-400 text-sm">
        Connect your wallet to view portfolio stats.
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3">
      <StatCard
        label="MIPO Balance"
        value={formatMipo(mipoBalance)}
        sub="tokens held"
        icon={Layers}
      />
      <StatCard
        label="MIPO Staked"
        value={formatMipo(stakedAmount)}
        sub="locked tokens"
        icon={TrendingUp}
      />
      <StatCard
        label="Claimable"
        value={formatUsdc(allClaimable as bigint | undefined)}
        sub="USDC dividends"
        icon={Gift}
        accent
      />
      <StatCard
        label="USDC Balance"
        value={formatUsdc(usdcBalance)}
        sub="in wallet"
        icon={CircleDollarSign}
      />
    </div>
  )
}
