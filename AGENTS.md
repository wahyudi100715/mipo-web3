# [App Name]

> Built with Arc Studio - money-powered apps in minutes

This is the **project memory** - what Arc Studio remembers about building this app. It helps future agents (or humans) understand and extend the project.

---

## What This App Does

MIPO (Mini IPO) — Web3 crowdfunding platform for tokenizing Real World Assets with halal profit-sharing. Businesses issue ERC-20 tokens (70% public sale / 20% business LP / 10% platform), investors stake tokens for 90-day minimum lock, and receive quarterly USDC dividends proportional to their stake.

## Deployed Contracts (Arc Testnet)

| Contract | Address | Explorer |
|---|---|---|
| MIPOToken | 0x8e926193c475920cd78aa41e28ee7b9d16acb4ad | https://explorer.testnet.arc.io/address/0x8e926193c475920cd78aa41e28ee7b9d16acb4ad |
| MIPOStaking | 0xf072bea72cd3c61256f3d72ede43f11db3a200ee | https://explorer.testnet.arc.io/address/0xf072bea72cd3c61256f3d72ede43f11db3a200ee |
| MIPODividend | 0x171a704133368b36a65b48028125a5d4e428b2fa | https://explorer.testnet.arc.io/address/0x171a704133368b36a65b48028125a5d4e428b2fa |

- USDC (Arc Testnet): 0x3600000000000000000000000000000000000000
- Platform/Owner wallet: 0x1034BceB7732C3ea1F08d6e33aeEE3388656b2cC (walletmu — admin semua fungsi)
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
