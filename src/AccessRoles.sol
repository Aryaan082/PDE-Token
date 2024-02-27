// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/Context.sol";

enum Roles {
	Nonmerchant,
	Merchant,
	Admin
}

contract AccessRoles is Context {
	// Mapping from address to role
	mapping(address => Roles) private _roles;

	event RoleGranted(Roles indexed role, address indexed account, address indexed sender);

	event RoleRevoked(Roles indexed role, address indexed account, address indexed sender);

	constructor() {
		_roles[_msgSender()] = Roles.Admin;
	}

	modifier onlyRole(Roles role) {
		require(hasRole(role, _msgSender()), "ERC721: required role not granted");
		_;
	}

	function hasRole(Roles role, address account) public view returns (bool) {
		return _roles[account] == role;
	}

	function getRole(address account) public view returns (Roles) {
		return _roles[account];
	}

	function grantRole(Roles role, address account) public onlyRole(Roles.Admin) {
		_grantRole(role, account);
	}

	function revokeRole(address account) public onlyRole(Roles.Admin) {
		_revokeRole(account);
	}

	function _grantRole(Roles role, address account) internal virtual {
		if (!hasRole(role, account)) {
			_roles[account] = role;
			emit RoleGranted(role, account, _msgSender());
		}
	}

	function _revokeRole(address account) internal virtual {
		_roles[account] = Roles.Nonmerchant;
		emit RoleRevoked(_roles[account], account, _msgSender());
	}
}
