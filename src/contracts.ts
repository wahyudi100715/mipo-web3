/**
 * MIPO contract addresses + ABIs — Arc Testnet
 * Auto-generated from deployment artifacts. Do not edit addresses manually.
 */

import mipoTokenArtifact from '../contracts/out/MIPOToken.sol/MIPOToken.json'
import mipoStakingArtifact from '../contracts/out/MIPOStaking.sol/MIPOStaking.json'
import mipoConvertedArtifact from '../contracts/out/MIPODividend.sol/MIPODividend.json'

export const MIPO_TOKEN = {
  address: '0x8e926193c475920cd78aa41e28ee7b9d16acb4ad' as `0x${string}`,
  abi: mipoTokenArtifact.abi,
} as const

export const MIPO_STAKING = {
  address: '0xf072bea72cd3c61256f3d72ede43f11db3a200ee' as `0x${string}`,
  abi: mipoStakingArtifact.abi,
} as const

export const MIPO_DIVIDEND = {
  address: '0x171a704133368b36a65b48028125a5d4e428b2fa' as `0x${string}`,
  abi: mipoConvertedArtifact.abi,
} as const

export const PLATFORM_WALLET = '0x1034BceB7732C3ea1F08d6e33aeEE3388656b2cC' as `0x${string}`
export const ARC_TESTNET_CHAIN_ID = 5042002
