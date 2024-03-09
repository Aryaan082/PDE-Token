// SPDX-License-Identifier: MIT
pragma solidity 0.8.17;

import "@openzeppelin/contracts/utils/Context.sol";

enum Roles {
	Nonmerchant,
	Merchant,
	Admin,
	HeadAdmin
}

contract AccessRoles is Context {
	// Mapping from address to role
	mapping(address => Roles) private _roles;

	event RoleGranted(Roles indexed role, address indexed account, address indexed sender);

	event RoleRevoked(Roles indexed role, address indexed account, address indexed sender);

	constructor() {
		_roles[_msgSender()] = Roles.HeadAdmin;
	}

	modifier onlyRole(Roles role) {
		require(
			hasRole(role, _msgSender()) || _roles[_msgSender()] == Roles.HeadAdmin,
			"AccessRoles: required role not granted"
		);
		_;
	}

	function hasRole(Roles role, address account) public view returns (bool) {
		return _roles[account] == role;
	}

	function getRole(address account) public view returns (Roles) {
		return _roles[account];
	}

	function grantRole(Roles role, address account) public onlyRole(Roles.Admin) {
		if (role == Roles.Admin || role == Roles.HeadAdmin) {
			require(
				hasRole(Roles.HeadAdmin, _msgSender()),
				"AccessRoles: to grant admin or head admin role, head admin required"
			);
			_grantRole(role, account);
			return;
		}

		_grantRole(role, account);
	}

	function revokeRole(address account) public onlyRole(Roles.Admin) {
		if (_roles[account] == Roles.Admin || _roles[account] == Roles.HeadAdmin) {
			require(
				hasRole(Roles.HeadAdmin, _msgSender()),
				"AccessRoles: to revoke admin or head admin role, head admin required"
			);
			_revokeRole(account);
			return;
		}

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
