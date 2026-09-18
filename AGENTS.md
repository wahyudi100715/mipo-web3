# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

MIPO (Mini IPO) — Web3 crowdfunding platform for tokenizing Real World Assets with halal profit-sharing. Businesses issue ERC-20 tokens (70% public sale / 20% business LP / 10% platform), investors stake tokens for 90-day minimum lock, and receive quarterly USDC dividends proportional to their stake.

## Deployed Contracts (Arc Testnet)

| Contract | Address | Explorer |
|---|---|---|
| MIPOToken | 0x0ab6d4addde26728189efa4bb1b35df9e7f4c2ee | https://explorer.testnet.arc.io/address/0x0ab6d4addde26728189efa4bb1b35df9e7f4c2ee |
| MIPOStaking | 0x8ac2b0eec3ea9e9988279c6fe1ea04e82ce704a5 | https://explorer.testnet.arc.io/address/0x8ac2b0eec3ea9e9988279c6fe1ea04e82ce704a5 |
| MIPODividend | 0xae47e5118e2db804cb237895c8e44a5ccafab7c3 | https://explorer.testnet.arc.io/address/0xae47e5118e2db804cb237895c8e44a5ccafab7c3 |

- USDC (Arc Testnet): 0x3600000000000000000000000000000000000000
- Platform/Deployer wallet: 0x5B12Ce46C7194aD57d143bC22847224047b1Ef42
- Token: 1,000,000 MIPO | Price: 1 USDC/token | Lock: 90 days | Fees: 1% stake / 0.5% unstake / 0.5% transfer

## Tech Stack

- Frontend: React 18, Vite, TypeScript, Tailwind CSS
- Web3: wagmi v2, viem v2, ConnectKit
- Contracts: Solidity 0.8.28 + Foundry. Sources in `contracts/`, unit tests in `contracts/test/*.t.sol`. Build with `bun run contracts:build` (`forge build`), test with `bun run contracts:test` (`forge test`).
- Wallet: injected (MetaMask, etc.)
- Chain: Arc Testnet (Chain ID: 5042002, imported from `viem/chains`)
- Token: USDC (6 decimals) (Address: 0x3600000000000000000000000000000000000000, Chain: Arc Testnet)
- Toasts: Sonner

## Key Files

- `src/App.tsx` - Main application logic
- `src/components/` - UI components
- `src/config.ts` - wagmi config (chains, connectors, transports)

## To Run

```bash
bun install
bun run dev
```
