// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./ERC721_KYC.sol";
import "./ERC721_Burn.sol";
import "./AccessRoles.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract ERC20_PDE is ERC20 {
	AccessRoles private _access;
	ERC721_KYC private _erc721_kyc;
	ERC721_Burn private _erc721_burn;

	uint256 private _interestRateOneBps;
	uint256 private _interestRateTwoBps;
	uint256 private _interestRateThreeBps;

	struct Receipt {
		uint256 tokenAmount;
		uint256 interestRateOne;
		uint256 interestRateTwo;
		uint256 interestRateThree;
		uint256 timestamp;
	}

	mapping(address => Receipt[]) private _receipts;

	constructor(
		string memory name_,
		string memory symbol_,
		uint256 interestRateOneBps_,
		uint256 interestRateTwoBps_,
		uint256 interestRateThreeBps_,
		address access_,
		address kyc_,
		address burn_
	) ERC20(name_, symbol_) {
		_interestRateOneBps = interestRateOneBps_;
		_interestRateTwoBps = interestRateTwoBps_;
		_interestRateThreeBps = interestRateThreeBps_;

		_access = AccessRoles(access_);
		_erc721_kyc = ERC721_KYC(kyc_);
		_erc721_burn = ERC721_Burn(burn_);
	}

	function setAccessControl(address access_) public {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");
		_access = AccessRoles(access_);
	}

	function setKYC(address kyc_) public {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");
		_erc721_kyc = ERC721_KYC(kyc_);
	}

	function setBurn(address burn_) public {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");
		_erc721_burn = ERC721_Burn(burn_);
	}

	function interestRateOneBps() public view virtual returns (uint256) {
		return _interestRateOneBps;
	}

	function setInterestRateOneBps(uint256 interestRateBps_) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");
		_interestRateOneBps = interestRateBps_;
	}

	function interestRateTwoBps() public view virtual returns (uint256) {
		return _interestRateTwoBps;
	}

	function setInterestRateTwoBps(uint256 interestRateBps_) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");
		_interestRateTwoBps = interestRateBps_;
	}

	function interestRateThreeBps() public view virtual returns (uint256) {
		return _interestRateThreeBps;
	}

	function setInterestRateThreeBps(uint256 interestRateBps_) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");
		_interestRateThreeBps = interestRateBps_;
	}

	function balanceOf(address account) public view virtual override returns (uint256) {
		if (_access.hasRole(Roles.Admin, account) || _erc721_kyc.balanceOf(account) == 0) {
			return super.balanceOf(account);
		}

		uint256 numReceipts = _receipts[account].length;
		uint256 totalTokens;
		uint256 tokens;
		uint256 elapsedTime;
		for (uint256 i = 0; i < numReceipts; ++i) {
			tokens = _receipts[account][i].tokenAmount;
			elapsedTime = (block.timestamp - _receipts[account][i].timestamp) / 1 days;
			totalTokens += _calculateBalanceOfReceipt(
				tokens,
				_receipts[account][i].interestRateOne,
				_receipts[account][i].interestRateTwo,
				_receipts[account][i].interestRateThree,
				elapsedTime
			);
		}

		return totalTokens + super.balanceOf(account);
	}

	function _calculateBalanceOfReceipt(
		uint256 tokenAmount,
		uint256 rateOneBps,
		uint256 rateTwoBps,
		uint256 rateThreeBps,
		uint256 elapsedTime
	) internal view virtual returns (uint256) {
		if (elapsedTime <= 30) {
			for (uint256 i = 0; i < elapsedTime; ++i) {
				tokenAmount += (tokenAmount * rateOneBps) / 10_000;
			}
		} else if (elapsedTime <= 60) {
			for (uint256 i = 0; i < 30; ++i) {
				tokenAmount += (tokenAmount * rateOneBps) / 10_000;
			}

			for (uint256 ii = 30; ii < elapsedTime; ++ii) {
				tokenAmount += (tokenAmount * rateTwoBps) / 10_000;
			}
		} else if (elapsedTime <= 90) {
			for (uint256 i = 0; i < 30; ++i) {
				tokenAmount += (tokenAmount * rateOneBps) / 10_000;
			}

			for (uint256 ii = 30; ii < 60; ++ii) {
				tokenAmount += (tokenAmount * rateTwoBps) / 10_000;
			}

			for (uint256 iii = 60; iii < elapsedTime; ++iii) {
				tokenAmount += (tokenAmount * rateThreeBps) / 10_000;
			}
		} else {
			for (uint256 i = 0; i < 30; ++i) {
				tokenAmount += (tokenAmount * rateOneBps) / 10_000;
			}

			for (uint256 ii = 30; ii < 60; ++ii) {
				tokenAmount += (tokenAmount * rateTwoBps) / 10_000;
			}

			for (uint256 iii = 60; iii < 90; ++iii) {
				tokenAmount += (tokenAmount * rateThreeBps) / 10_000;
			}
		}

		return tokenAmount;
	}

	function transferFrom(address from, address to, uint256 amount) public virtual override returns (bool) {
		require(_access.hasRole(Roles.Admin, _msgSender()) || _msgSender() == from, "ERC20: required role not granted");
		_transfer(from, to, amount);
		return true;
	}

	function _transfer(address from, address to, uint256 amount) internal virtual override {
		require(from != address(0), "ERC20: transfer from the zero address");
		require(to != address(0), "ERC20: transfer to the zero address");
		require(amount != 0, "ERC20: transfer amount is zero");

		_beforeTokenTransfer(from, to, amount);

		if (_access.hasRole(Roles.Admin, from) && balanceOf(from) < amount + 50_000 ether) {
			mint(from, amount + 50_000 ether - balanceOf(from));
		}

		uint256 totalWithInterest = balanceOf(from);

		require(totalWithInterest >= amount, "PDE: Transfer amount exceeds balance with interest");

		uint256 numReceipts = _receipts[from].length;
		uint256 tokens;
		uint256 elapsedTime;
		for (uint256 i = numReceipts; i > 0; ++i) {
			tokens = _receipts[from][i - 1].tokenAmount;
			elapsedTime = (block.timestamp - _receipts[from][i - 1].timestamp) / 1 days;
			// inflated token amount
			tokens = _calculateBalanceOfReceipt(
				tokens,
				_receipts[from][i - 1].interestRateOne,
				_receipts[from][i - 1].interestRateTwo,
				_receipts[from][i - 1].interestRateThree,
				elapsedTime
			);

			if (tokens <= amount) {
				amount -= tokens;
				_receipts[from].pop();
				continue;
			}

			emit Transfer(from, to, amount);

			// cannot be 0 since (tokens > _receipts[from][i - 1].tokenAmount) and token (amount != 0)
			uint256 inflationMultiplierBps = (tokens * 1_000_000_000) / _receipts[from][i - 1].tokenAmount;

			_receipts[from][i - 1].tokenAmount -= (amount * 1_000_000_000) / inflationMultiplierBps;

			amount = 0;

			break;
		}

		if (amount > 0) {
			super._transfer(from, to, amount);
		}

		_afterTokenTransfer(from, to, amount);
	}

	function mint(address account, uint256 amount) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");
		_mint(account, amount);
	}

	function burn(address account, uint256 amount, bool mintToken) public virtual {
		require(account != address(0), "ERC20: burn from the zero address");
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC20: required role not granted");

		if (mintToken) {
			_erc721_burn.safeMint(account, amount);
		}

		if (_access.hasRole(Roles.Admin, account) || _receipts[account].length == 0) {
			_burn(account, amount);
			return;
		}

		uint256 amountLeft = amount;

		uint256 totalWithInterest = balanceOf(account);

		require(totalWithInterest >= amount, "PDE: Burn amount exceeds balance with interest");

		uint256 numReceipts = _receipts[account].length;
		uint256 tokens;
		uint256 elapsedTime;
		for (uint256 i = numReceipts; i > 0; ++i) {
			tokens = _receipts[account][i - 1].tokenAmount;
			elapsedTime = (block.timestamp - _receipts[account][i - 1].timestamp) / 1 days;
			// inflated token amount
			tokens = _calculateBalanceOfReceipt(
				tokens,
				_receipts[account][i - 1].interestRateOne,
				_receipts[account][i - 1].interestRateTwo,
				_receipts[account][i - 1].interestRateThree,
				elapsedTime
			);

			if (tokens <= amountLeft) {
				amountLeft -= tokens;
				_receipts[account].pop();
				continue;
			}

			uint256 inflationMultiplierBps = (tokens * 1_000_000_000) / _receipts[account][i - 1].tokenAmount;

			_receipts[account][i - 1].tokenAmount -= (amountLeft * 1_000_000_000) / inflationMultiplierBps;

			amount = 0;

			break;
		}

		if (amount > 0) {
			super._burn(account, amountLeft);
		}

		_afterTokenTransfer(account, address(0), amount);
	}

	function _afterTokenTransfer(address, address to, uint256 amount) internal virtual override {
		if (to == address(0)) {
			return;
		}

		if (_erc721_kyc.balanceOf(to) > 0) {
			_receipts[to].push(
				Receipt(amount, _interestRateOneBps, _interestRateTwoBps, _interestRateThreeBps, block.timestamp)
			);

			super._burn(to, amount);
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
