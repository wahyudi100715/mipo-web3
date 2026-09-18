# MIPO (Mini IPO) — Implementation Plan

## Summary
MIPO adalah platform crowdfunding Web3 berbasis Arc Testnet yang men-tokenisasi aset bisnis nyata (RWA) dengan skema profit-sharing halal. Satu bisnis deploy satu set contract: token ERC-20, staking/lock, dan dividend distributor — semua pembayaran dan dividen dalam USDC.

## User Answers
- Token sale model: Fixed price (harga tetap dalam USDC, first-come first-served)
- Stablecoin: USDC saja (native di Arc Testnet)
- Profit oracle: Admin tunggal (owner contract) dengan 2-step confirm safeguard
- Scope: Satu bisnis per deploy

## Architecture

**Blockchain:** Arc Testnet — USDC sebagai gas token native, sub-second finality, biaya stabil.

**Smart Contracts (3 file Solidity):**

### MIPOToken.sol
ERC-20 token bisnis + funding phase + secondary market fee
- Constructor: `name, symbol, totalSupply, pricePerToken (USDC 6 dec), platformWallet`
- `buyTokens(uint256 amount)` — beli token di Funding Phase dengan USDC
  - Otomatis alokasi: 70% public sale, 20% locked business LP, 10% locked platform fee
- `endFundingPhase()` — admin tutup fase penjualan (onlyOwner)
- `transfer` / `transferFrom` — override dengan fee 0.5% ke platform di secondary market
- Read: `publicSaleRemaining()`, `fundingPhaseActive()`, `pricePerToken()`
- Events: `TokensPurchased`, `FundingPhaseEnded`, `TransferFee`

### MIPOStaking.sol
Lock token, catat posisi staker, kelola fee
- `stake(uint256 amount)` — lock token min 3 bulan, fee 1% ke platform
- `unstake(uint256 amount)` — withdraw setelah lock period, fee 0.5% ke platform
- `emergencyPause()` / `unpause()` — admin pause semua operasi (onlyOwner)
- Read: `stakedBalance(address)`, `lockExpiry(address)`, `totalStaked()`, `canUnstake(address)`
- Events: `Staked`, `Unstaked`, `EmergencyPaused`

### MIPODividend.sol
Submit profit, konfirmasi, distribusi, klaim dividen per periode (3 bulanan)
- `submitProfit(uint256 periodId, uint256 usdcAmount)` — admin input profit
- `confirmProfit(uint256 periodId)` — admin konfirmasi final (2-step safeguard)
- `distributeDividend(uint256 periodId)` — transfer USDC ke semua staker aktif proporsional
- `claimDividend(uint256 periodId)` — staker klaim jatah USDC mereka
- Read: `pendingDividend(address, uint256)`, `claimableAmount(address)`, `periodInfo(uint256)`
- Events: `DividendSubmitted`, `DividendConfirmed`, `DividendDistributed`, `DividendClaimed`

**Wallet:** ConnectKit (sudah terpasang di sandbox)

## Files to Create / Modify

### Contracts
1. `contracts/MIPOToken.sol` — ERC-20 token bisnis + funding phase + secondary market fee
2. `contracts/MIPOStaking.sol` — stake/unstake dengan lock 3 bulan + fee + pause
3. `contracts/MIPODividend.sol` — submit profit, confirm, distribute, claim dividen

### Frontend
4. `src/App.tsx` — entrypoint utama, tab navigation, wagmi config Arc Testnet
5. `src/config.ts` — contract addresses + ABIs post-deploy
6. `src/components/StakePanel.tsx` — form stake/unstake, saldo, lock timer countdown
7. `src/components/DividendPanel.tsx` — daftar periode, jumlah klaim, tombol Claim
8. `src/components/PortfolioStats.tsx` — ringkasan: token dimiliki, staked, total dividen
9. `src/components/AdminPanel.tsx` — input profit, konfirmasi, eksekusi distribusi (gated by owner)

## Build Sequence

1. Tulis MIPOToken.sol — ERC-20 dengan alokasi 70/20/10, fixed-price sale, secondary fee
2. Tulis MIPOStaking.sol — stake/unstake, 3-bulan lock, fee, Pausable
3. Tulis MIPODividend.sol — periode profit, 2-step confirm, distribusi proporsional, pull claim
4. Security review balanced (critical + high) — tiga contract memegang USDC pengguna
5. Deploy ke Arc Testnet — urutan: Token → Staking (pass token addr) → Dividend (pass staking + token)
6. Post-deploy: panggil `setStakingContract` dan `setDividendContract` di MIPOToken
7. Bangun semua komponen UI dan wire ABI dari `contracts/out/`
8. Integrasi akhir: beli token → stake → admin input profit → claim dividen

## Done When

- [ ] Ketiga contract ter-deploy di Arc Testnet, alamat tercatat di `config.ts`
- [ ] User bisa connect wallet dan melihat saldo token MIPO
- [ ] Tombol Stake berfungsi: token ter-lock, timer 3 bulan tampil di UI
- [ ] Panel Dividend menampilkan periode aktif dan jumlah USDC klaim
- [ ] Tombol Claim Dividend mengirim USDC ke wallet staker
- [ ] Admin Panel hanya terlihat untuk owner wallet, bisa submit + konfirmasi profit
- [ ] Emergency Pause membekukan semua operasi stake/unstake
- [ ] Fee staking 1% dan unstaking 0.5% masuk ke platform wallet
