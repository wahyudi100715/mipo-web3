// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

interface IMIPOStaking {
    function stakedBalance(address user) external view returns (uint256);
    function totalStaked() external view returns (uint256);
    function canUnstake(address user) external view returns (bool);
    function firstStakedAt(address user) external view returns (uint256);
}

contract MIPODividend is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    IMIPOStaking public stakingContract;

    uint256 public periodDuration = 90 days;
    uint256 public currentPeriodId;
    uint256 public totalUnclaimedLiability;
    uint256 public constant MAX_DISTRIBUTION_BATCH = 500;

    struct Period {
        uint256 id;
        uint256 startTime;
        uint256 endTime;
        uint256 profitAmount;
        bool submitted;
        bool confirmed;
        bool distributed;
        bool finalized;
        uint256 totalStakedSnapshot;
        uint256 distributedAt;
    }

    mapping(uint256 => Period) public periods;
    mapping(uint256 => mapping(address => bool)) public hasClaimed;
    mapping(address => uint256) public totalClaimed;
    mapping(uint256 => mapping(address => uint256)) public dividendOwed;
    mapping(uint256 => mapping(address => bool)) private _accountedInPeriod;

    event ProfitSubmitted(uint256 indexed periodId, uint256 usdcAmount, uint256 timestamp);
    event ProfitConfirmed(uint256 indexed periodId, uint256 usdcAmount, uint256 timestamp);
    event DividendDistributed(uint256 indexed periodId, uint256 totalUsdc, uint256 stakerCount);
    event DividendClaimed(uint256 indexed periodId, address indexed user, uint256 amount);
    event PeriodAdvanced(uint256 indexed newPeriodId, uint256 startTime, uint256 endTime);

    constructor(address usdc_, address stakingContract_, address owner_) Ownable(msg.sender) {
        require(usdc_ != address(0), "Invalid USDC");
        require(stakingContract_ != address(0), "Invalid staking");
        require(owner_ != address(0), "Invalid owner");

        usdc = IERC20(usdc_);
        stakingContract = IMIPOStaking(stakingContract_);

        Period storage p = periods[0];
        p.id = 0;
        p.startTime = block.timestamp;
        p.endTime = block.timestamp + periodDuration;

        currentPeriodId = 0;

        _transferOwnership(owner_);
    }

    function submitProfit(uint256 periodId, uint256 usdcAmount) external onlyOwner {
        require(periodId <= currentPeriodId, "Invalid period");
        require(!periods[periodId].submitted, "Already submitted");
        require(usdcAmount > 0, "Zero amount");

        periods[periodId].profitAmount = usdcAmount;
        periods[periodId].submitted = true;

        emit ProfitSubmitted(periodId, usdcAmount, block.timestamp);
    }

    function confirmProfit(uint256 periodId) external onlyOwner {
        require(periodId <= currentPeriodId, "Invalid period");

        Period storage p = periods[periodId];
        require(p.submitted, "Not submitted");
        require(!p.confirmed, "Already confirmed");

        p.confirmed = true;

        emit ProfitConfirmed(periodId, p.profitAmount, block.timestamp);
    }

    /// @dev Call multiple times with non-overlapping staker batches if >500 stakers. _accountedInPeriod prevents double-counting. Do not mark distributed=true until last batch — IMPORTANT: see below.
    function distributeDividend(uint256 periodId, address[] calldata stakers) external onlyOwner nonReentrant {
        require(periodId <= currentPeriodId, "Invalid period");
        require(stakers.length <= MAX_DISTRIBUTION_BATCH, "Batch too large");

        Period storage p = periods[periodId];
        require(p.confirmed, "Not confirmed");
        require(!p.finalized, "Already finalized");

        uint256 profit = p.profitAmount;
        require(profit > 0, "No profit");

        if (p.distributedAt == 0) {
            usdc.safeTransferFrom(msg.sender, address(this), profit);
        }

        uint256 totalStakedSnap;
        if (p.distributedAt == 0) {
            totalStakedSnap = stakingContract.totalStaked();
            require(totalStakedSnap > 0, "No staked tokens");
            p.totalStakedSnapshot = totalStakedSnap;
            p.distributedAt = block.timestamp;
        } else {
            totalStakedSnap = p.totalStakedSnapshot;
            require(totalStakedSnap > 0, "No snapshot");
        }

        uint256 totalAssigned;

        for (uint256 i = 0; i < stakers.length; i++) {
            address staker = stakers[i];
            if (staker == address(0) || _accountedInPeriod[periodId][staker]) {
                continue;
            }

            uint256 firstStake = stakingContract.firstStakedAt(staker);
            if (firstStake == 0 || firstStake > periods[periodId].startTime) {
                continue;
            }

            uint256 stakerBalance = stakingContract.stakedBalance(staker);
            if (stakerBalance == 0) {
                continue;
            }

            uint256 share = (profit * stakerBalance) / totalStakedSnap;
            if (share == 0) {
                continue;
            }

            if (totalAssigned + share > profit) {
                share = profit - totalAssigned;
            }

            dividendOwed[periodId][staker] += share;
            _accountedInPeriod[periodId][staker] = true;
            totalAssigned += share;
        }

        totalUnclaimedLiability += totalAssigned;

        emit DividendDistributed(periodId, profit, stakers.length);
    }

    function finalizePeriod(uint256 periodId) external onlyOwner {
        Period storage p = periods[periodId];
        require(p.confirmed, "Not confirmed");
        require(!p.finalized, "Already finalized");
        require(p.distributedAt != 0, "No distribution batch run yet");

        p.finalized = true;
        p.distributed = true;

        emit DividendDistributed(periodId, p.profitAmount, 0);
    }

    function claimDividend(uint256 periodId) external nonReentrant whenNotPaused {
        require(periodId <= currentPeriodId, "Invalid period");

        Period storage p = periods[periodId];
        require(p.distributed, "Not distributed");
        require(!hasClaimed[periodId][msg.sender], "Already claimed");

        uint256 amount = dividendOwed[periodId][msg.sender];
        require(amount > 0, "Nothing to claim");

        hasClaimed[periodId][msg.sender] = true;
        totalClaimed[msg.sender] += amount;

        usdc.safeTransfer(msg.sender, amount);
        totalUnclaimedLiability -= amount;

        emit DividendClaimed(periodId, msg.sender, amount);
    }

    function advancePeriod() external onlyOwner {
        uint256 nextPeriodId = currentPeriodId + 1;
        uint256 startTime = block.timestamp;
        uint256 endTime = startTime + periodDuration;

        periods[nextPeriodId] = Period({
            id: nextPeriodId,
            startTime: startTime,
            endTime: endTime,
            profitAmount: 0,
            submitted: false,
            confirmed: false,
            distributed: false,
            finalized: false,
            totalStakedSnapshot: 0,
            distributedAt: 0
        });

        currentPeriodId = nextPeriodId;

        emit PeriodAdvanced(nextPeriodId, startTime, endTime);
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function rescueUSDC(address to, uint256 amount) external onlyOwner nonReentrant {
        require(to != address(0), "Invalid recipient");
        require(amount > 0, "Zero amount");

        uint256 contractBalance = usdc.balanceOf(address(this));
        require(contractBalance >= totalUnclaimedLiability, "Liabilities exceed balance");
        uint256 surplus = contractBalance - totalUnclaimedLiability;
        require(amount <= surplus, "Cannot rescue owed dividends");

        usdc.safeTransfer(to, amount);
    }

    function claimableAmount(address user, uint256 periodId) external view returns (uint256) {
        if (periodId > currentPeriodId || hasClaimed[periodId][user]) {
            return 0;
        }
        return dividendOwed[periodId][user];
    }

    function periodInfo(uint256 periodId) external view returns (Period memory) {
        return periods[periodId];
    }

    function hasClaimedPeriod(address user, uint256 periodId) external view returns (bool) {
        return hasClaimed[periodId][user];
    }

    function allClaimableForUser(address user) external view returns (uint256 total) {
        for (uint256 i = 0; i <= currentPeriodId; i++) {
            if (periods[i].distributed && !hasClaimed[i][user]) {
                total += dividendOwed[i][user];
            }
        }
    }
}
