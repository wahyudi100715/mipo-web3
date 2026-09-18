// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract MIPOToken is ERC20, Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    IERC20 public usdc;
    address public platformWallet;
    address public businessWallet;
    uint256 public pricePerToken;
    bool public fundingPhaseActive;
    uint256 public publicSaleAllocated;
    uint256 public publicSaleSold;

    uint256 public constant STAKING_FEE_BPS = 100;
    uint256 public constant UNSTAKE_FEE_BPS = 50;
    uint256 public constant TRANSFER_FEE_BPS = 50;

    address public stakingContract;
    address public dividendContract;
    bool public feesEnabled;

    event TokensPurchased(address indexed buyer, uint256 tokenAmount, uint256 usdcCost);
    event FundingPhaseEnded(uint256 timestamp, uint256 totalSold);
    event TransferFeeCharged(address indexed from, address indexed to, uint256 fee);
    event StakingContractSet(address indexed staking);
    event DividendContractSet(address indexed dividend);

    constructor(
        string memory name_,
        string memory symbol_,
        uint256 totalSupply_,
        uint256 pricePerToken_,
        address usdc_,
        address platformWallet_,
        address businessWallet_,
        address owner_
    ) ERC20(name_, symbol_) Ownable(msg.sender) {
        require(usdc_ != address(0), "Invalid USDC");
        require(platformWallet_ != address(0), "Invalid platform wallet");
        require(businessWallet_ != address(0), "Invalid business wallet");
        require(owner_ != address(0), "Invalid owner");
        require(totalSupply_ > 0, "Invalid supply");
        require(pricePerToken_ > 0, "Invalid price");

        usdc = IERC20(usdc_);
        platformWallet = platformWallet_;
        businessWallet = businessWallet_;
        pricePerToken = pricePerToken_;

        _mint(address(this), totalSupply_);

        uint256 publicAlloc = (totalSupply_ * 70) / 100;
        uint256 lpAlloc = (totalSupply_ * 20) / 100;
        uint256 platformAlloc = (totalSupply_ * 10) / 100;

        _transfer(address(this), businessWallet_, lpAlloc);
        _transfer(address(this), platformWallet_, platformAlloc);

        publicSaleAllocated = publicAlloc;
        fundingPhaseActive = true;

        _transferOwnership(owner_);
    }

    function buyTokens(uint256 tokenAmount) external nonReentrant whenNotPaused {
        require(fundingPhaseActive, "Funding inactive");
        require(tokenAmount > 0, "Zero amount");
        require(publicSaleSold + tokenAmount <= publicSaleAllocated, "Insufficient sale allocation");

        uint256 usdcCost = (tokenAmount * pricePerToken) / 1e18;
        require(usdcCost > 0, "Cost rounds to zero");

        usdc.safeTransferFrom(msg.sender, address(this), usdcCost);
        _transfer(address(this), msg.sender, tokenAmount);

        publicSaleSold += tokenAmount;

        emit TokensPurchased(msg.sender, tokenAmount, usdcCost);
    }

    function endFundingPhase() external onlyOwner {
        require(fundingPhaseActive, "Already ended");
        fundingPhaseActive = false;
        feesEnabled = true;

        emit FundingPhaseEnded(block.timestamp, publicSaleSold);
    }

    function withdrawUnsoldTokens(address to) external onlyOwner {
        require(!fundingPhaseActive, "Funding active");
        require(to != address(0), "Invalid recipient");

        uint256 unsold = publicSaleAllocated - publicSaleSold;
        require(unsold > 0, "No unsold tokens");

        _transfer(address(this), to, unsold);
    }

    function withdrawFundingProceeds(address to) external onlyOwner {
        require(to != address(0), "Invalid recipient");

        uint256 proceeds = usdc.balanceOf(address(this));
        require(proceeds > 0, "No proceeds");

        usdc.safeTransfer(to, proceeds);
    }

    function setStakingContract(address staking_) external onlyOwner {
        require(staking_ != address(0), "Invalid staking");
        stakingContract = staking_;
        emit StakingContractSet(staking_);
    }

    function setDividendContract(address dividend_) external onlyOwner {
        require(dividend_ != address(0), "Invalid dividend");
        dividendContract = dividend_;
        emit DividendContractSet(dividend_);
    }

    function setPlatformWallet(address wallet_) external onlyOwner {
        require(wallet_ != address(0), "Invalid wallet");
        platformWallet = wallet_;
    }

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }

    function _update(address from, address to, uint256 amount) internal override {
        _requireNotPaused();

        bool chargeFee =
            feesEnabled
            && from != address(0)
            && to != address(0)
            && from != stakingContract
            && to != stakingContract
            && from != dividendContract
            && to != dividendContract
            && from != address(this);

        if (chargeFee && amount > 0) {
            uint256 fee = (amount * TRANSFER_FEE_BPS) / 10_000;
            uint256 netAmount = amount - fee;

            if (fee > 0) {
                super._update(from, platformWallet, fee);
                emit TransferFeeCharged(from, to, fee);
            }

            super._update(from, to, netAmount);
            return;
        }

        super._update(from, to, amount);
    }
}
