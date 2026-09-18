Baik, jawaban kamu sudah jelas. Berikut rencana lengkap MIPO berdasarkan pilihan tersebut. Sekarang saya punya semua informasi yang dibutuhkan. Berikut rencana lengkapnya:

---

## Implementation Plan: MIPO (Mini IPO) Platform

### Summary
MIPO adalah platform crowdfunding Web3 berbasis Arc Testnet yang men-tokenisasi aset bisnis nyata (RWA) dengan skema profit-sharing halal. Satu bisnis deploy satu set contract: token ERC-20, staking/lock, dan dividend distributor — semua pembayaran dan dividen dalam USDC.

---

### Architecture

**Blockchain:** Arc Testnet — USDC sebagai gas token native, sub-second finality, biaya stabil. Ideal untuk platform payment/DeFi berbasis USDC.

**Smart Contracts (3 file Solidity):**

1. `MIPOToken.sol` — ERC-20 token bisnis
   - Constructor: nama token, simbol, total supply, harga USDC per token, alamat staking contract, platform fee wallet
   - `buyTokens(uint256 amount)` — beli token di Funding Phase dengan USDC, otomatis split 70/20/10
   - `endFundingPhase()` — admin tutup fase penjualan
   - `transfer` / `transferFrom` — override dengan fee 0.5% ke platform jika secondary market (setelah funding selesai)
   - Read: `publicSaleRemaining()`, `fundingPhaseActive()`, `pricePerToken()`

2. `MIPOStaking.sol` — lock token, catat posisi staker
   - `stake(uint256 amount)` — lock token, kenakan fee staking 1% ke platform, mulai 3-bulan lock timer
   - `unstake(uint256 amount)` — withdraw token setelah lock period, kenakan fee unstaking 0.5%
   - `emergencyPause()` / `unpause()` — admin pause semua operasi
   - Read: `stakedBalance(address)`, `lockExpiry(address)`, `totalStaked()`, `canUnstake(address)`

3. `MIPODividend.sol` — distribusi dividen periodik
   - `submitProfit(uint256 periodId, uint256 usdcAmount)` — admin input profit bisnis untuk suatu periode (3 bulanan)
   - `confirmProfit(uint256 periodId)` — admin konfirmasi final sebelum distribusi bisa dieksekusi (2-step safeguard)
   - `distributeDividend(uint256 periodId)` — eksekusi distribusi USDC ke semua staker aktif secara proporsional
   - `claimDividend(uint256 periodId)` — staker klaim jatah dividen mereka
   - Read: `pendingDividend(address, uint256 periodId)`, `claimableAmount(address)`, `periodInfo(uint256 periodId)`
   - Event: `DividendSubmitted`, `DividendConfirmed`, `DividendClaimed`

**Frontend (React + Tailwind + wagmi/ConnectKit):**
- Tiga halaman/tab: Staking, Dividend, Portfolio
- Komponen utama: `StakePanel`, `DividendPanel`, `PortfolioStats`

**Wallet:** ConnectKit (sudah terpasang di sandbox)

---

### Files to Create / Modify

**Contracts:**
1. `contracts/MIPOToken.sol` — ERC-20 token bisnis + funding phase + secondary market fee
2. `contracts/MIPOStaking.sol` — stake/unstake dengan lock 3 bulan + fee + pause
3. `contracts/MIPODividend.sol` — submit profit, confirm, distribute, claim dividen

**Frontend:**
4. `src/App.tsx` — entrypoint utama, routing tab, wagmi config ke Arc Testnet
5. `src/config.ts` — tambah contract addresses post-deploy
6. `src/components/StakePanel.tsx` — form stake/unstake, tampilkan saldo & lock timer
7. `src/components/DividendPanel.tsx` — daftar periode dividen, jumlah yang bisa diklaim, tombol Claim
8. `src/components/PortfolioStats.tsx` — ringkasan: token dimiliki, staked, total dividen diterima
9. `src/components/AdminPanel.tsx` — input profit, konfirmasi, eksekusi distribusi (hanya terlihat jika wallet = admin)

---

### Build Sequence

1. **Tulis ketiga contract Solidity** — MIPOToken → MIPOStaking → MIPODividend. Staking butuh alamat token; Dividend butuh alamat staking. Constructor args dirancang agar bisa di-deploy secara berurutan.
2. **Security review** (balanced: critical + high) — tiga contract menyentuh fund custody, roles, dan external USDC calls; perlu review sebelum deploy.
3. **Deploy ke Arc Testnet** — urutan: deploy Token, deploy Staking (pass token address), deploy Dividend (pass staking + token address). Setelah deploy, panggil `MIPOToken.setStakingContract()` dan `setDividendContract()`.
4. **Bangun UI** — update `src/config.ts` dengan addresses hasil deploy, lalu bangun semua komponen. Wiring ABI dari artifacts di `contracts/out/`.
5. **Integrasi akhir** — pastikan semua flow terhubung: beli token → stake → tunggu 3 bulan (disimulasi di testnet) → admin input profit → claim dividen.

---

### Done When

- [ ] Ketiga contract ter-deploy di Arc Testnet dan alamatnya tercatat di `config.ts`
- [ ] User bisa connect wallet dan melihat saldo token MIPO
- [ ] Tombol Stake berfungsi: token ter-lock, timer 3 bulan mulai berjalan
- [ ] Panel Dividend menampilkan periode aktif dan jumlah USDC yang bisa diklaim
- [ ] Tombol Claim Dividend mengirim USDC ke wallet staker
- [ ] Admin Panel terlihat hanya untuk wallet pemilik, dan bisa submit + konfirmasi profit
- [ ] Emergency Pause berfungsi membekukan stake/unstake
- [ ] Fee staking (1%) dan unstaking (0.5%) masuk ke platform wallet

---

Ini adalah contract dengan banyak moving parts (fund custody, multi-role, fee handling, time-locked positions) — jadi saya akan menjalankan security review balanced sebelum deploy. Ini akan menambah sedikit waktu tapi penting mengingat contract ini memegang USDC pengguna.

Kalau kamu ingin review lebih cepat (critical saja) atau lebih dalam (medium + low juga), bilang saja. Kalau sudah siap, approve plan ini dan pindah ke **Build mode** untuk mulai build. Plan tersimpan di `arc-studio-plans/PLAN.md`.

Ringkasan arsitektur tiga contract:

```
MIPOToken ──── buyTokens() ──── USDC masuk
     │              │
     │         70% public sale
     │         20% locked (bisnis)
     │         10% locked (platform)
     │
MIPOStaking ── stake() / unstake() ── fee 1% / 0.5%
     │              │
     │         lock 3 bulan anti-dump
     │
MIPODividend ─ submitProfit() ─── admin input
              ─ confirmProfit() ── 2-step safeguard
              ─ claimDividend() ── staker tarik USDC
```

**Yang perlu kamu siapkan sebelum build:**
- Wallet testnet dengan USDC dari [faucet.circle.com](https://faucet.circle.com) — untuk gas + test beli token
- Alamat wallet platform (untuk menampung fee 10% + fee staking/unstaking)

Pindah ke **Build mode** untuk mulai eksekusi. Build akan berjalan secara berurutan: tulis contract → review keamanan → deploy → bangun UI.
