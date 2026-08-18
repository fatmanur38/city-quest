// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice The only thing the rest of the system needs to ask the registry.
interface IInstitutionRegistry {
    function isAuthorizedInstitution(address account) external view returns (bool);
}
