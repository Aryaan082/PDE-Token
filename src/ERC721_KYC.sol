// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "./AccessRoles.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract ERC721_KYC is ERC721 {
	AccessRoles private _access;

	string private _defaultTokenURI;

	uint256 private _tokenId;

	mapping(uint256 => string) private _tokenURIs;

	constructor(string memory name_, string memory symbol_, address access_) ERC721(name_, symbol_) {
		_access = AccessRoles(access_);
	}

	function setAccessControl(address access_) public {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		_access = AccessRoles(access_);
	}

	function tokenURI(uint256 tokenId) public view virtual override returns (string memory) {
		_requireMinted(tokenId);

		string memory _tokenURI = _tokenURIs[tokenId];

		// If there is no token URI, return the default URI
		if (bytes(_tokenURI).length > 0) {
			return _tokenURI;
		}

		return _defaultTokenURI;
	}

	function setTokenURI(uint256 tokenId, string memory _tokenURI) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		require(_exists(tokenId), "ERC721: invalid token ID");
		_tokenURIs[tokenId] = _tokenURI;
	}

	function setDefaultTokenURI(string memory defaultTokenURI_) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		_defaultTokenURI = defaultTokenURI_;
	}

	function transferFrom(address from, address to, uint256 tokenId) public virtual override {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		_transfer(from, to, tokenId);
	}

	function safeTransferFrom(address from, address to, uint256 tokenId) public virtual override {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		safeTransferFrom(from, to, tokenId, "");
	}

	function safeTransferFrom(address from, address to, uint256 tokenId, bytes memory data) public virtual override {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		_safeTransfer(from, to, tokenId, data);
	}

	function safeMint(address to) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		_safeMint(to, _tokenId);
		++_tokenId;
	}

	function burn(uint256 tokenId) public virtual {
		require(_access.hasRole(Roles.Admin, _msgSender()), "ERC721: required role not granted");
		_burn(tokenId);
	}

	function approve(address to, uint256 tokenId) public virtual override {}

	function getApproved(uint256) public view virtual override returns (address) {
		return address(0);
	}

	function setApprovalForAll(address, bool) public virtual override {}

	function isApprovedForAll(address, address) public view virtual override returns (bool) {
		return false;
	}
}
