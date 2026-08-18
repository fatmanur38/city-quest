// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {InstitutionRegistry} from "../../src/InstitutionRegistry.sol";
import {CityPassport} from "../../src/CityPassport.sol";
import {ExperiencePass} from "../../src/ExperiencePass.sol";

/// @notice Shared fixture: a city with a municipality, a library and a science center.
abstract contract CityQuestTest is Test {
    InstitutionRegistry internal registry;
    CityPassport internal passport;
    ExperiencePass internal experiencePass;

    address internal admin = makeAddr("municipality-admin");
    address internal relayer = makeAddr("relayer");
    address internal citizen = makeAddr("citizen");
    address internal otherCitizen = makeAddr("other-citizen");

    uint256 internal libraryPk = 0xA11CE;
    uint256 internal scienceCenterPk = 0xB0B;
    uint256 internal municipalityPk = 0xC17;
    uint256 internal impostorPk = 0xBAD;

    address internal library_;
    address internal scienceCenter;
    address internal municipality;
    address internal impostor;

    bytes32 internal constant LIBRARY_VISIT = keccak256("LIBRARY_VISIT");
    bytes32 internal constant EARTHQUAKE_EXPERIENCE = keccak256("EARTHQUAKE_EXPERIENCE");
    bytes32 internal constant YOUNG_SCIENTIST = keccak256("YOUNG_SCIENTIST");

    /// @dev Cached deliberately. Reading `registry.REGISTRAR_ROLE()` inline inside a test would
    ///      be an external call, and an external call swallows a pending `vm.prank`.
    bytes32 internal constant REGISTRAR_ROLE = keccak256("REGISTRAR_ROLE");
    bytes32 internal constant CREDENTIAL_ISSUER_ROLE = keccak256("CREDENTIAL_ISSUER_ROLE");

    function setUp() public virtual {
        library_ = vm.addr(libraryPk);
        scienceCenter = vm.addr(scienceCenterPk);
        municipality = vm.addr(municipalityPk);
        impostor = vm.addr(impostorPk);

        // Start at a realistic timestamp so day arithmetic is meaningful.
        vm.warp(1_760_000_000);

        vm.startPrank(admin);
        registry = new InstitutionRegistry(admin);
        passport = new CityPassport(admin, address(registry), "https://cityquest.local/api/credential/");
        experiencePass = new ExperiencePass(
            admin, address(registry), address(passport), "https://cityquest.local/api/pass/"
        );
        passport.grantRole(passport.CREDENTIAL_ISSUER_ROLE(), address(experiencePass));

        registry.registerInstitution(library_, "Selcuklu Library", InstitutionRegistry.InstitutionType.Library);
        registry.registerInstitution(
            scienceCenter, "Konya Science Center", InstitutionRegistry.InstitutionType.ScienceCenter
        );
        registry.registerInstitution(
            municipality, "Konya Municipality", InstitutionRegistry.InstitutionType.Municipality
        );
        vm.stopPrank();
    }

    function _today() internal view returns (uint64) {
        return uint64(block.timestamp / 1 days);
    }

    function _claim(address recipient, address institution, bytes32 credentialType, uint64 periodId)
        internal
        view
        returns (CityPassport.ActivityClaim memory)
    {
        return CityPassport.ActivityClaim({
            recipient: recipient,
            institution: institution,
            credentialType: credentialType,
            periodId: periodId,
            expiresAt: uint64(block.timestamp + 5 minutes),
            nonce: keccak256(abi.encode(recipient, institution, credentialType, periodId, "nonce"))
        });
    }

    function _sign(uint256 pk, CityPassport.ActivityClaim memory claim)
        internal
        view
        returns (bytes memory)
    {
        (uint8 v, bytes32 r, bytes32 s) = vm.sign(pk, passport.hashClaim(claim));
        return abi.encodePacked(r, s, v);
    }

    /// @notice The production path: an institution signs, a relayer submits, the citizen pays
    ///         nothing and signs nothing.
    function _relay(uint256 institutionPk, CityPassport.ActivityClaim memory claim)
        internal
        returns (uint256 tokenId)
    {
        bytes memory signature = _sign(institutionPk, claim);
        vm.prank(relayer);
        return passport.verifyActivity(claim, signature);
    }
}
