// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

/// @title InstitutionRegistry
/// @notice The shared list of institutions that are allowed to issue achievements in a city.
///
/// @dev This contract is the reason the whole system needs a blockchain. If a single
///      municipality ran every library, museum and science center, this list would just be a
///      table in that municipality's database. It is not: libraries, universities, museums and
///      foundations are independent organisations. They need one registry that none of them
///      individually owns, and that any of them (or any outside party) can read without
///      permission.
///
///      Only administrators (the municipality, in the MVP) may add or disable an institution,
///      but *everyone* can verify who is authorised.
///
///      Institution metadata beyond the public name lives off-chain. Nothing here is personal
///      data: these are public organisations, not people.
contract InstitutionRegistry is AccessControl {
    /// @notice Role allowed to register and disable institutions.
    bytes32 public constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");

    enum InstitutionType {
        Library,
        ScienceCenter,
        Museum,
        University,
        Municipality,
        Other
    }

    struct Institution {
        string name;
        InstitutionType kind;
        bool active;
        bool registered;
        uint32 registeredAtDay;
    }

    /// @dev Keyed by the institution's signing address. One address == one institution identity.
    mapping(address account => Institution) private _institutions;

    /// @dev Insertion-ordered list, so the admin dashboard can enumerate without an indexer.
    address[] private _accounts;

    event InstitutionRegistered(address indexed account, InstitutionType indexed kind, string name);
    event InstitutionStatusChanged(address indexed account, bool active);
    event InstitutionRenamed(address indexed account, string name);

    error InstitutionAlreadyRegistered(address account);
    error InstitutionNotRegistered(address account);
    error InvalidAccount();
    error EmptyName();

    constructor(address admin) {
        if (admin == address(0)) revert InvalidAccount();
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGISTRAR_ROLE, admin);
    }

    /// @notice Authorise an institution to issue achievements.
    /// @param account The address the institution signs claims with.
    function registerInstitution(address account, string calldata name, InstitutionType kind)
        external
        onlyRole(REGISTRAR_ROLE)
    {
        if (account == address(0)) revert InvalidAccount();
        if (bytes(name).length == 0) revert EmptyName();
        if (_institutions[account].registered) revert InstitutionAlreadyRegistered(account);

        _institutions[account] = Institution({
            name: name,
            kind: kind,
            active: true,
            registered: true,
            registeredAtDay: uint32(block.timestamp / 1 days)
        });
        _accounts.push(account);

        emit InstitutionRegistered(account, kind, name);
        emit InstitutionStatusChanged(account, true);
    }

    /// @notice Suspend an institution. Achievements it already issued stay valid; it simply
    ///         cannot issue new ones. Revoking past achievements is a separate, deliberate act.
    function deactivateInstitution(address account) external onlyRole(REGISTRAR_ROLE) {
        _setActive(account, false);
    }

    /// @notice Re-enable a previously suspended institution.
    function reactivateInstitution(address account) external onlyRole(REGISTRAR_ROLE) {
        _setActive(account, true);
    }

    function renameInstitution(address account, string calldata name) external onlyRole(REGISTRAR_ROLE) {
        if (!_institutions[account].registered) revert InstitutionNotRegistered(account);
        if (bytes(name).length == 0) revert EmptyName();
        _institutions[account].name = name;
        emit InstitutionRenamed(account, name);
    }

    function _setActive(address account, bool active) private {
        if (!_institutions[account].registered) revert InstitutionNotRegistered(account);
        _institutions[account].active = active;
        emit InstitutionStatusChanged(account, active);
    }

    /// @notice The question every other contract in this system asks.
    function isAuthorizedInstitution(address account) external view returns (bool) {
        Institution storage institution = _institutions[account];
        return institution.registered && institution.active;
    }

    function getInstitution(address account) external view returns (Institution memory) {
        return _institutions[account];
    }

    function institutionCount() external view returns (uint256) {
        return _accounts.length;
    }

    function institutionAt(uint256 index) external view returns (address) {
        return _accounts[index];
    }

    /// @notice Enumerate every registered institution. Bounded by the number of organisations in
    ///         a city, and only ever called from off-chain reads.
    function allInstitutions() external view returns (address[] memory) {
        return _accounts;
    }
}
