/**
 * MIPO contract addresses + ABIs — Arc Testnet
 * Auto-generated from deployment artifacts. Do not edit addresses manually.
 */

import mipoTokenArtifact from '../contracts/out/MIPOToken.sol/MIPOToken.json'
import mipoStakingArtifact from '../contracts/out/MIPOStaking.sol/MIPOStaking.json'
import mipoConvertedArtifact from '../contracts/out/MIPODividend.sol/MIPODividend.json'

export const MIPO_TOKEN = {
  address: '0x0ab6d4addde26728189efa4bb1b35df9e7f4c2ee' as `0x${string}`,
  abi: mipoTokenArtifact.abi,
} as const

export const MIPO_STAKING = {
  address: '0x8ac2b0eec3ea9e9988279c6fe1ea04e82ce704a5' as `0x${string}`,
  abi: mipoStakingArtifact.abi,
} as const

export const MIPO_DIVIDEND = {
  address: '0xae47e5118e2db804cb237895c8e44a5ccafab7c3' as `0x${string}`,
  abi: mipoConvertedArtifact.abi,
} as const

export const PLATFORM_WALLET = '0x5B12Ce46C7194aD57d143bC22847224047b1Ef42' as `0x${string}`
export const ARC_TESTNET_CHAIN_ID = 5042002
