import { useState } from 'react'
import { useAccount } from 'wagmi'
import { ConnectKitButton } from 'connectkit'
import { motion, AnimatePresence } from 'framer-motion'
import { LayoutDashboard, Lock, Gift, ShieldCheck, ExternalLink } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'

import { PortfolioStats } from '@/components/PortfolioStats'
import { StakePanel } from '@/components/StakePanel'
import { DividendPanel } from '@/components/DividendPanel'
import { AdminPanel } from '@/components/AdminPanel'
import { PLATFORM_WALLET, MIPO_TOKEN, MIPO_STAKING, MIPO_DIVIDEND } from '@/contracts'

type Tab = 'dashboard' | 'stake' | 'dividend' | 'admin'

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'stake', label: 'Staking', icon: Lock },
  { id: 'dividend', label: 'Dividen', icon: Gift },
  { id: 'admin', label: 'Admin', icon: ShieldCheck },
]

function ContractLinks() {
  const links = [
    { label: 'Token', addr: MIPO_TOKEN.address },
    { label: 'Staking', addr: MIPO_STAKING.address },
    { label: 'Dividend', addr: MIPO_DIVIDEND.address },
  ]
  return (
    <div className="flex flex-wrap gap-2 justify-center">
      {links.map(({ label, addr }) => (
        <a
          key={label}
          href={`https://explorer.testnet.arc.io/address/${addr}`}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-xs text-slate-400 hover:text-indigo-500 transition-colors"
        >
          <ExternalLink size={10} />
          {label}: {addr.slice(0, 6)}…{addr.slice(-4)}
        </a>
      ))}
    </div>
  )
}

export default function App() {
  const { address } = useAccount()
  const [tab, setTab] = useState<Tab>('dashboard')
  const isAdmin = address?.toLowerCase() === PLATFORM_WALLET.toLowerCase()

  const visibleTabs = TABS.filter((t) => t.id !== 'admin' || isAdmin)

  return (
    <div className="min-h-dvh bg-gradient-to-br from-slate-50 via-indigo-50/30 to-slate-100 font-['DM_Sans',sans-serif]">
      {/* Google Fonts */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=DM+Sans:wght@400;500;600&display=swap');`}</style>

      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/70 backdrop-blur-md border-b border-slate-200/60">
        <div className="max-w-md mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <TokenUSDC size={18} variant="mono" className="text-white" />
            </div>
            <div>
              <div className="font-['Space_Grotesk'] font-bold text-slate-900 text-base leading-none tracking-tight">MIPO</div>
              <div className="text-[10px] text-slate-400 leading-none mt-0.5">Mini IPO Platform</div>
            </div>
          </div>
          <ConnectKitButton />
        </div>
      </header>

      <main className="max-w-md mx-auto px-4 pt-5 pb-28 space-y-5">
        {/* Hero */}
        <div className="rounded-2xl bg-gradient-to-br from-indigo-600 to-indigo-800 p-5 text-white shadow-lg shadow-indigo-200/50">
          <div className="text-xs font-semibold uppercase tracking-widest text-indigo-200 mb-1">Arc Testnet</div>
          <h1 className="font-['Space_Grotesk'] text-2xl font-bold leading-tight tracking-tight text-balance">
            Tokenisasi Bisnis Nyata
          </h1>
          <p className="text-indigo-200 text-sm mt-1.5 text-pretty">
            Beli token bisnis, stake minimal 90 hari, dan terima dividen USDC setiap kuartal — tanpa bunga, tanpa riba.
          </p>
          <div className="flex gap-3 mt-3 text-xs text-indigo-200">
            <span>70% public sale</span>
            <span>·</span>
            <span>20% LP bisnis</span>
            <span>·</span>
            <span>10% platform</span>
          </div>
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.18 }}
          >
            {tab === 'dashboard' && (
              <div className="space-y-4">
                <div className="text-xs font-semibold uppercase tracking-widest text-slate-500 px-1">Portfolio Kamu</div>
                <PortfolioStats />
                <div className="rounded-2xl bg-white/60 border border-slate-200/60 backdrop-blur-sm p-4 space-y-2.5">
                  <div className="text-xs font-semibold uppercase tracking-widest text-slate-500">Info Token MIPO Demo</div>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    {[
                      { label: 'Total Supply', value: '1,000,000 MIPO' },
                      { label: 'Harga Sale', value: '1 USDC / token' },
                      { label: 'Min. Lock', value: '90 hari' },
                      { label: 'Fee Staking', value: '1% / 0.5%' },
                    ].map(({ label, value }) => (
                      <div key={label} className="bg-slate-50 rounded-xl p-2.5">
                        <div className="text-slate-400">{label}</div>
                        <div className="text-slate-800 font-semibold mt-0.5">{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <ContractLinks />
              </div>
            )}
            {tab === 'stake' && <StakePanel />}
            {tab === 'dividend' && <DividendPanel />}
            {tab === 'admin' && isAdmin && <AdminPanel />}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 bg-white/80 backdrop-blur-md border-t border-slate-200/60">
        <div className="max-w-md mx-auto flex">
          {visibleTabs.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 transition-colors ${
                tab === id ? 'text-indigo-600' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              <Icon size={18} strokeWidth={tab === id ? 2.5 : 1.8} />
              <span className="text-[10px] font-semibold">{label}</span>
              {tab === id && (
                <motion.div
                  layoutId="tab-indicator"
                  className="absolute bottom-0 w-8 h-0.5 bg-indigo-500 rounded-full"
                />
              )}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
