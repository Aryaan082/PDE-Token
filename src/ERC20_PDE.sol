// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./ERC721_KYC.sol";
import "./ERC721_Burn.sol";
import "./AccessRoles.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "hardhat/console.sol";

contract ERC20_PDE is ERC20 {
	AccessRoles private _access;
	ERC721_KYC private _erc721_kyc;
	ERC721_Burn private _erc721_burn;

	uint256 private _periodLengthDays;
	uint256 private _numPeriods;
	uint256[12] private _interestRateBps;

	struct Receipt {
		uint256 tokenAmount;
		uint256 periodLengthDays;
		uint256 numPeriods;
		uint256[12] interestRateBps;
		uint256 timestamp;
	}

	mapping(address => Receipt[]) private _receipts;
	mapping(address => bool) private _banned;

	constructor(
		string memory name_,
		string memory symbol_,
		address access_,
		address kyc_,
		address burn_
	) ERC20(name_, symbol_) {
		_access = AccessRoles(access_);
		_erc721_kyc = ERC721_KYC(kyc_);
		_erc721_burn = ERC721_Burn(burn_);
	}

	function setAccessControl(address access_) public {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");
		_access = AccessRoles(access_);
	}

	function setKYC(address kyc_) public {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");
		_erc721_kyc = ERC721_KYC(kyc_);
	}

	function setBurn(address burn_) public {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");
		_erc721_burn = ERC721_Burn(burn_);
	}

	function getPeriodLengthDays() public view virtual returns (uint256) {
		return _periodLengthDays;
	}

	function setPeriodLengthDays(uint256 periodLengthDays_) public virtual {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");
		_periodLengthDays = periodLengthDays_;
	}

	function getNumPeriods() public view virtual returns (uint256) {
		return _numPeriods;
	}

	function setNumPeriods(uint256 numPeriods_) public virtual {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");
		require(numPeriods_ < 12, "PDE: max number of periods is 12");

		_numPeriods = numPeriods_;
	}

	function getInterestRate(uint256 period_) public view virtual returns (uint256) {
		return _interestRateBps[period_];
	}

	function setInterestRateBps(uint256 period_, uint256 interestRateBps_) public virtual {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");
		require(period_ < 12, "PDE: max number of periods is 12");
		_interestRateBps[period_] = interestRateBps_;
	}

	function getBanStatus(address account_) public view returns (bool) {
		return _banned[account_];
	}

	function ban(address account_, bool status_) public {
		require(
			_access.hasRole(Roles.HeadAdmin, _msgSender()) || _access.hasRole(Roles.Admin, _msgSender()),
			"PDE: required role not granted"
		);
		_banned[account_] = status_;
	}

	function balanceOf(address account) public view virtual override returns (uint256) {
		if (
			_access.hasRole(Roles.HeadAdmin, account) ||
			_access.hasRole(Roles.Admin, account) ||
			_erc721_kyc.balanceOf(account) == 0
		) {
			return super.balanceOf(account);
		}

		uint256 numReceipts = _receipts[account].length;
		uint256 totalTokens;
		uint256 tokens;
		uint256 elapsedTimeDays;
		for (uint256 i = 0; i < numReceipts; ++i) {
			tokens = _receipts[account][i].tokenAmount;
			elapsedTimeDays = (block.timestamp - _receipts[account][i].timestamp) / 1 days;
			// inflated token amount
			totalTokens += _calculateBalanceOfReceipt(
				tokens,
				_receipts[account][i].periodLengthDays,
				_receipts[account][i].numPeriods,
				_receipts[account][i].interestRateBps,
				elapsedTimeDays
			);
		}

		return totalTokens + super.balanceOf(account);
	}

	function _calculateBalanceOfReceipt(
		uint256 tokenAmount,
		uint256 periodLengthDays,
		uint256 numPeriods,
		uint256[12] memory interestRateBps,
		uint256 elapsedTimeDays
	) internal view virtual returns (uint256) {
		uint256 priorPeriods = elapsedTimeDays / periodLengthDays;
		uint256 remainderPeriod = elapsedTimeDays % periodLengthDays;
		uint256 currentPeriod = 0;

		while (currentPeriod < priorPeriods && currentPeriod < numPeriods) {
			for (uint256 ii = 0; ii < periodLengthDays; ++ii) {
				tokenAmount += (tokenAmount * interestRateBps[currentPeriod]) / 10_000;
			}

			++currentPeriod;
		}

		if (currentPeriod == numPeriods) {
			return tokenAmount;
		}

		for (uint256 i = 0; i < remainderPeriod; ++i) {
			tokenAmount += (tokenAmount * interestRateBps[currentPeriod]) / 10_000;
		}

		return tokenAmount;
	}

	function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
		require(
			_access.hasRole(Roles.HeadAdmin, _msgSender()) || _msgSender() == from,
			"PDE: required role not granted"
		);
		_transfer(from, to, amount);
		return true;
	}

	function _transfer(address from, address to, uint256 amount) internal virtual override {
		require(!_banned[from], "PDE: transfer from a banned address");
		require(from != address(0), "PDE: transfer from the zero address");
		require(to != address(0), "PDE: transfer to the zero address");
		require(amount != 0, "PDE: transfer amount is zero");

		_beforeTokenTransfer(from, to, amount);

		if (_access.hasRole(Roles.HeadAdmin, from) && balanceOf(from) < amount + 100 ether) {
			_mint(from, amount + 100 ether - balanceOf(from));
		}

		uint256 amountLeft = amount;
		uint256 totalWithInterest = balanceOf(from);

		require(totalWithInterest >= amount, "PDE: Transfer amount exceeds balance with interest");

		uint256 numReceipts = _receipts[from].length;
		uint256 tokens;
		uint256 elapsedTimeDays;
		for (uint256 i = numReceipts; i > 0; --i) {
			tokens = _receipts[from][i - 1].tokenAmount;
			elapsedTimeDays = (block.timestamp - _receipts[from][i - 1].timestamp) / 1 days;
			// inflated token amount
			tokens = _calculateBalanceOfReceipt(
				tokens,
				_receipts[from][i - 1].periodLengthDays,
				_receipts[from][i - 1].numPeriods,
				_receipts[from][i - 1].interestRateBps,
				elapsedTimeDays
			);

			if (tokens <= amountLeft) {
				amountLeft -= tokens;
				_receipts[from].pop();
				continue;
			}

			uint256 inflationMultiplierBps = (tokens * 1_000_000_000) / _receipts[from][i - 1].tokenAmount;

			_receipts[from][i - 1].tokenAmount -= (amountLeft * 1_000_000_000) / inflationMultiplierBps;

			amountLeft = 0;

			break;
		}

		if (amountLeft > 0) {
			_burn(from, amountLeft);
		}

		_mint(to, amount);
	}

	function burn(address account, uint256 amount, bool mintToken) public virtual {
		require(account != address(0), "PDE: burn from the zero address");
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");

		if (mintToken) {
			_erc721_burn.safeMint(account, amount);
		}

		if (
			_access.hasRole(Roles.HeadAdmin, account) ||
			_access.hasRole(Roles.Admin, account) ||
			_receipts[account].length == 0
		) {
			_burn(account, amount);
			return;
		}

		uint256 amountLeft = amount;
		uint256 totalWithInterest = balanceOf(account);

		require(totalWithInterest >= amount, "PDE: Burn amount exceeds balance with interest");

		uint256 numReceipts = _receipts[account].length;
		uint256 tokens;
		uint256 elapsedTimeDays;
		for (uint256 i = numReceipts; i > 0; --i) {
			tokens = _receipts[account][i - 1].tokenAmount;
			elapsedTimeDays = (block.timestamp - _receipts[account][i - 1].timestamp) / 1 days;
			// inflated token amount
			tokens = _calculateBalanceOfReceipt(
				tokens,
				_receipts[account][i - 1].periodLengthDays,
				_receipts[account][i - 1].numPeriods,
				_receipts[account][i - 1].interestRateBps,
				elapsedTimeDays
			);

			if (tokens <= amountLeft) {
				amountLeft -= tokens;
				_receipts[account].pop();
				continue;
			}

			uint256 inflationMultiplierBps = (tokens * 1_000_000_000) / _receipts[account][i - 1].tokenAmount;

			_receipts[account][i - 1].tokenAmount -= (amountLeft * 1_000_000_000) / inflationMultiplierBps;

			amountLeft = 0;

			break;
		}

		if (amountLeft > 0) {
			_burn(account, amountLeft);
		}
	}

	function mint(address account, uint256 amount) public virtual {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "PDE: required role not granted");
		_mint(account, amount);
	}

	function _mint(address account, uint256 amount) internal override {
		if (
			_erc721_kyc.balanceOf(account) > 0 &&
			!_access.hasRole(Roles.Admin, account) &&
			!_access.hasRole(Roles.HeadAdmin, account)
		) {
			_receipts[account].push(Receipt(amount, _periodLengthDays, _numPeriods, _interestRateBps, block.timestamp));
		} else {
			super._mint(account, amount);
		}
	}

	function allowance(address, address) public pure override returns (uint256) {
		return 0;
	}

	function approve(address, uint256) public virtual override returns (bool) {
		return false;
	}

	function increaseAllowance(address, uint256) public virtual override returns (bool) {
		return false;
	}

	function decreaseAllowance(address, uint256) public virtual override returns (bool) {
		return false;
	}
}
