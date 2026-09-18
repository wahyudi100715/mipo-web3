// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MIPOStaking is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public mipoToken;
    IERC20 public usdc;
    address public platformWallet;
    address public dividendContract;

    uint256 public constant LOCK_DURATION = 90 days;
    uint256 public constant STAKE_FEE_BPS = 100;
    uint256 public constant UNSTAKE_FEE_BPS = 50;

    uint256 public totalStaked;

    struct StakeInfo {
        uint256 amount;
        uint256 lockExpiry;
        uint256 stakedAt;
        uint256 firstStakedAt;
    }

    mapping(address => StakeInfo) public stakes;

    event Staked(address indexed user, uint256 grossAmount, uint256 netAmount, uint256 fee, uint256 lockExpiry);
    event Unstaked(address indexed user, uint256 grossAmount, uint256 netAmount, uint256 fee);
    event EmergencyPaused(address indexed by);

    constructor(address mipoToken_, address usdc_, address platformWallet_, address owner_) Ownable(msg.sender) {
        require(mipoToken_ != address(0), "Invalid MIPO token");
        require(usdc_ != address(0), "Invalid USDC");
        require(platformWallet_ != address(0), "Invalid platform wallet");
        require(owner_ != address(0), "Invalid owner");

        mipoToken = IERC20(mipoToken_);
        usdc = IERC20(usdc_);
        platformWallet = platformWallet_;

        _transferOwnership(owner_);
    }

    function stake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");

        mipoToken.safeTransferFrom(msg.sender, address(this), amount);

        uint256 fee = (amount * STAKE_FEE_BPS) / 10_000;
        uint256 netAmount = amount - fee;

        if (fee > 0) {
            mipoToken.safeTransfer(platformWallet, fee);
        }

        StakeInfo storage info = stakes[msg.sender];
        uint256 newExpiry = block.timestamp + LOCK_DURATION;

        if (info.amount > 0) {
            info.amount += netAmount;
            if (newExpiry > info.lockExpiry) {
                info.lockExpiry = newExpiry;
            }
            info.stakedAt = block.timestamp;
        } else {
            stakes[msg.sender] = StakeInfo({amount: netAmount, lockExpiry: newExpiry, stakedAt: block.timestamp, firstStakedAt: block.timestamp});
            info = stakes[msg.sender];
        }

        totalStaked += netAmount;

        emit Staked(msg.sender, amount, netAmount, fee, info.lockExpiry);
    }

    function unstake(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Zero amount");

        StakeInfo storage info = stakes[msg.sender];
        require(info.amount >= amount, "Insufficient staked");
        require(block.timestamp >= info.lockExpiry, "Lock period not expired");

        info.amount -= amount;
        totalStaked -= amount;

        uint256 fee = (amount * UNSTAKE_FEE_BPS) / 10_000;
        uint256 netAmount = amount - fee;

        if (fee > 0) {
            mipoToken.safeTransfer(platformWallet, fee);
        }
        mipoToken.safeTransfer(msg.sender, netAmount);

        if (info.amount == 0) {
            delete stakes[msg.sender];
        }

        emit Unstaked(msg.sender, amount, netAmount, fee);
    }

    function setDividendContract(address dividend_) external onlyOwner {
        require(dividend_ != address(0), "Invalid dividend");
        dividendContract = dividend_;
    }

    function setPlatformWallet(address wallet_) external onlyOwner {
        require(wallet_ != address(0), "Invalid wallet");
        platformWallet = wallet_;
    }

    function emergencyPause() external onlyOwner {
        _pause();
        emit EmergencyPaused(msg.sender);
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function stakedBalance(address user) external view returns (uint256) {
        return stakes[user].amount;
    }

    function lockExpiry(address user) external view returns (uint256) {
        return stakes[user].lockExpiry;
    }

    function firstStakedAt(address user) external view returns (uint256) {
        return stakes[user].firstStakedAt;
    }

    function canUnstake(address user) external view returns (bool) {
        StakeInfo memory info = stakes[user];
        return info.amount > 0 && block.timestamp >= info.lockExpiry;
    }

    function timeUntilUnlock(address user) external view returns (uint256) {
        StakeInfo memory info = stakes[user];

        if (info.amount == 0 || block.timestamp >= info.lockExpiry) {
            return 0;
        }

        return info.lockExpiry - block.timestamp;
    }

    function stakeInfo(address user) external view returns (uint256 amount, uint256 expiry, uint256 stakedAt, uint256 firstStakedAt_, bool unlocked) {
        StakeInfo memory info = stakes[user];
        amount = info.amount;
        expiry = info.lockExpiry;
        stakedAt = info.stakedAt;
        firstStakedAt_ = info.firstStakedAt;
        unlocked = info.amount > 0 && block.timestamp >= info.lockExpiry;
    }
}
