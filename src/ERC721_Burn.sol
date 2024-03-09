// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./ERC20_PDE.sol";
import "./ERC721_KYC.sol";
import "./AccessRoles.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

contract ERC721_Burn is ERC721 {
	AccessRoles private _access;
	ERC20_PDE private _erc20_PDE;

	uint256 _tokenId;

	string _defaultURI;

	mapping(uint256 => uint256) private _tokenIdToTokensBurned;

	constructor(string memory name_, string memory symbol_, address access_) ERC721(name_, symbol_) {
		_access = AccessRoles(access_);
	}

	function setPDE(address PDE_) public {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "BURN: required role not granted");
		_erc20_PDE = ERC20_PDE(PDE_);
	}

	function setAccessControl(address access_) public {
		require(_access.hasRole(Roles.HeadAdmin, _msgSender()), "BURN: required role not granted");
		_access = AccessRoles(access_);
	}

	function getTokensBurned(uint256 tokenId) public view returns (uint256) {
		_requireMinted(tokenId);
		return _tokenIdToTokensBurned[tokenId];
	}

	function safeMint(address to, uint256 tokensBurned) public virtual {
		require(
			_access.hasRole(Roles.HeadAdmin, _msgSender()) || _access.hasRole(Roles.Admin, _msgSender()),
			"BURN: required role not granted"
		);
		_mint(to, _tokenId);
		_tokenIdToTokensBurned[_tokenId] = tokensBurned;
		++_tokenId;
	}

	function burn(uint256 tokenId) public {
		require(
			_access.hasRole(Roles.HeadAdmin, _msgSender()) || _access.hasRole(Roles.Admin, _msgSender()),
			"BURN: required role not granted"
		);
		_burn(tokenId);
		delete _tokenIdToTokensBurned[tokenId];
	}

	function setTokenURI(string memory _tokenURI) public virtual {
		require(
			_access.hasRole(Roles.HeadAdmin, _msgSender()) || _access.hasRole(Roles.Admin, _msgSender()),
			"BURN: required role not granted"
		);
		_defaultURI = _tokenURI;
	}

	function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
		_requireMinted(tokenId);

		return _baseURI();
	}

	function _baseURI() internal view virtual override returns (string memory) {
		return _defaultURI;
	}

	function approve(address, uint256) public virtual override {}

	function getApproved(uint256) public view virtual override returns (address) {
		return address(0);
	}

	function setApprovalForAll(address, bool) public virtual override {}

	function isApprovedForAll(address, address) public view virtual override returns (bool) {
		return false;
	}

	function transferFrom(address, address, uint256) public virtual override {}

	function safeTransferFrom(address, address, uint256) public virtual override {}

	function safeTransferFrom(address, address, uint256, bytes memory) public virtual override {}
}
