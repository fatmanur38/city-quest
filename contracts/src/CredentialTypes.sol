// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @notice Canonical achievement identifiers.
/// @dev Only the hash lives on-chain. The human-readable title, artwork and description sit
///      off-chain, so a city can restyle its badges without touching a deployed contract.
///      The frontend derives the same values with `keccak256(toUtf8Bytes(name))`.
library CredentialTypes {
    bytes32 internal constant LIBRARY_VISIT = keccak256("LIBRARY_VISIT");
    bytes32 internal constant SCIENCE_CENTER_VISIT = keccak256("SCIENCE_CENTER_VISIT");
    bytes32 internal constant EARTHQUAKE_EXPERIENCE = keccak256("EARTHQUAKE_EXPERIENCE");
    bytes32 internal constant ROBOTICS_WORKSHOP = keccak256("ROBOTICS_WORKSHOP");
    bytes32 internal constant MUSEUM_EXPLORER = keccak256("MUSEUM_EXPLORER");
    bytes32 internal constant SCIENCE_EXPLORER = keccak256("SCIENCE_EXPLORER");
    bytes32 internal constant YOUNG_SCIENTIST = keccak256("YOUNG_SCIENTIST");
}
