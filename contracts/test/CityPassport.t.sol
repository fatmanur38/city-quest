// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CityQuestTest} from "./helpers/CityQuestTest.sol";
import {CityPassport} from "../src/CityPassport.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";

contract CityPassportTest is CityQuestTest {
    // -------------------------------------------------------------------------------------
    // Issuance and institutional authority
    // -------------------------------------------------------------------------------------

    function test_AuthorizedInstitutionIssuesCredentialToCorrectWallet() public {
        uint256 tokenId = _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        assertTrue(passport.hasCredential(citizen, LIBRARY_VISIT));
        assertEq(passport.ownerOf(tokenId), citizen);
        assertEq(passport.balanceOf(citizen), 1);
        assertFalse(passport.hasCredential(otherCitizen, LIBRARY_VISIT));

        CityPassport.Credential memory credential = passport.getCredential(citizen, LIBRARY_VISIT);
        assertEq(credential.issuer, library_, "credential must name the institution that vouched");
        assertEq(credential.credentialType, LIBRARY_VISIT);
        assertEq(credential.issuedAtDay, uint32(block.timestamp / 1 days));
        assertFalse(credential.revoked);
        assertTrue(credential.exists);
    }

    /// @dev The gasless story: authority comes from the signature, not from who pays.
    function test_AnyRelayerMaySubmitAnInstitutionSignedClaim() public {
        CityPassport.ActivityClaim memory claim = _claim(citizen, library_, LIBRARY_VISIT, _today());
        bytes memory signature = _sign(libraryPk, claim);

        address strangerPayingGas = makeAddr("stranger");
        vm.prank(strangerPayingGas);
        passport.verifyActivity(claim, signature);

        assertTrue(passport.hasCredential(citizen, LIBRARY_VISIT));
        assertEq(passport.balanceOf(strangerPayingGas), 0, "submitter must not receive the credential");
    }

    function test_RevertWhen_InstitutionIsNotRegistered() public {
        CityPassport.ActivityClaim memory claim = _claim(citizen, impostor, LIBRARY_VISIT, _today());
        bytes memory signature = _sign(impostorPk, claim);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(CityPassport.UnauthorizedInstitution.selector, impostor));
        passport.verifyActivity(claim, signature);
    }

    function test_RevertWhen_InstitutionHasBeenDeactivated() public {
        vm.prank(admin);
        registry.deactivateInstitution(library_);

        CityPassport.ActivityClaim memory claim = _claim(citizen, library_, LIBRARY_VISIT, _today());
        bytes memory signature = _sign(libraryPk, claim);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(CityPassport.UnauthorizedInstitution.selector, library_));
        passport.verifyActivity(claim, signature);
    }

    function test_RevertWhen_SignatureIsFromSomeoneElse() public {
        // Claims to be the library, signed with a key that is not the library's.
        CityPassport.ActivityClaim memory claim = _claim(citizen, library_, LIBRARY_VISIT, _today());
        bytes memory signature = _sign(impostorPk, claim);

        vm.prank(relayer);
        vm.expectRevert(CityPassport.InvalidSignature.selector);
        passport.verifyActivity(claim, signature);
    }

    function test_RevertWhen_ClaimIsTamperedWithAfterSigning() public {
        CityPassport.ActivityClaim memory claim = _claim(citizen, library_, LIBRARY_VISIT, _today());
        bytes memory signature = _sign(libraryPk, claim);

        claim.recipient = impostor; // redirect the achievement to someone else

        vm.prank(relayer);
        vm.expectRevert(CityPassport.InvalidSignature.selector);
        passport.verifyActivity(claim, signature);
    }

    function test_RevertWhen_ClaimHasExpired() public {
        CityPassport.ActivityClaim memory claim = _claim(citizen, library_, LIBRARY_VISIT, _today());
        bytes memory signature = _sign(libraryPk, claim);

        vm.warp(claim.expiresAt + 1);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(CityPassport.ClaimExpired.selector, claim.expiresAt));
        passport.verifyActivity(claim, signature);
    }

    // -------------------------------------------------------------------------------------
    // Replay protection and the daily library rule
    // -------------------------------------------------------------------------------------

    function test_RevertWhen_TheSameSignedClaimIsSubmittedTwice() public {
        CityPassport.ActivityClaim memory claim = _claim(citizen, library_, LIBRARY_VISIT, _today());
        bytes memory signature = _sign(libraryPk, claim);

        vm.startPrank(relayer);
        passport.verifyActivity(claim, signature);

        bytes32 recordKey = passport.activityRecordKey(citizen, library_, LIBRARY_VISIT, _today());
        vm.expectRevert(abi.encodeWithSelector(CityPassport.ActivityAlreadyVerified.selector, recordKey));
        passport.verifyActivity(claim, signature);
        vm.stopPrank();
    }

    /// @dev The walk-in-walk-out attack: leave the building, come back, ask for a fresh
    ///      signature. A new nonce does not help, because the record key does not contain one.
    function test_RevertWhen_LeavingAndReenteringTheLibraryOnTheSameDay() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        CityPassport.ActivityClaim memory secondVisit = _claim(citizen, library_, LIBRARY_VISIT, _today());
        secondVisit.nonce = keccak256("a genuinely fresh nonce");
        secondVisit.expiresAt = uint64(block.timestamp + 10 minutes);
        bytes memory freshSignature = _sign(libraryPk, secondVisit);

        bytes32 recordKey = passport.activityRecordKey(citizen, library_, LIBRARY_VISIT, _today());
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(CityPassport.ActivityAlreadyVerified.selector, recordKey));
        passport.verifyActivity(secondVisit, freshSignature);
    }

    function test_ReturningTheNextDayIsAllowedButDoesNotDuplicateTheBadge() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));
        assertEq(passport.credentialCount(citizen), 1);

        vm.warp(block.timestamp + 1 days);
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        assertEq(passport.credentialCount(citizen), 1, "a regular visitor collects one badge, not many");
        assertEq(passport.balanceOf(citizen), 1);
    }

    function test_DailyLimitIsPerCitizen() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));
        _relay(libraryPk, _claim(otherCitizen, library_, LIBRARY_VISIT, _today()));

        assertTrue(passport.hasCredential(citizen, LIBRARY_VISIT));
        assertTrue(passport.hasCredential(otherCitizen, LIBRARY_VISIT));
    }

    function test_DailyLimitIsPerInstitution() public {
        uint256 otherLibraryPk = 0xD006;
        address otherLibrary = vm.addr(otherLibraryPk);

        vm.prank(admin);
        registry.registerInstitution(
            otherLibrary, "Meram Library", InstitutionRegistry.InstitutionType.Library
        );

        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));
        // A different library on the same day is a different record key, and is allowed.
        _relay(otherLibraryPk, _claim(citizen, otherLibrary, LIBRARY_VISIT, _today()));

        assertEq(passport.credentialCount(citizen), 1, "still a single Library Visitor badge");
    }

    /// @dev periodId 0 means "once, ever" -- used for achievements that are not repeatable.
    function test_RevertWhen_OneTimeCredentialIsClaimedAgainOnALaterDay() public {
        _relay(scienceCenterPk, _claim(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, 0));

        vm.warp(block.timestamp + 30 days);
        CityPassport.ActivityClaim memory again = _claim(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, 0);
        bytes memory signature = _sign(scienceCenterPk, again);

        bytes32 recordKey = passport.activityRecordKey(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, 0);
        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(CityPassport.ActivityAlreadyVerified.selector, recordKey));
        passport.verifyActivity(again, signature);
    }

    function test_IsActivityVerifiedReflectsSpentKeys() public {
        bytes32 recordKey = passport.activityRecordKey(citizen, library_, LIBRARY_VISIT, _today());
        assertFalse(passport.isActivityVerified(recordKey));

        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));
        assertTrue(passport.isActivityVerified(recordKey));
    }

    // -------------------------------------------------------------------------------------
    // Soulbound behaviour
    // -------------------------------------------------------------------------------------

    function test_RevertWhen_CredentialIsTransferred() public {
        uint256 tokenId = _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        vm.prank(citizen);
        vm.expectRevert(CityPassport.SoulboundTransferNotAllowed.selector);
        passport.transferFrom(citizen, otherCitizen, tokenId);
    }

    function test_RevertWhen_CredentialIsSafeTransferred() public {
        uint256 tokenId = _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        vm.prank(citizen);
        vm.expectRevert(CityPassport.SoulboundTransferNotAllowed.selector);
        passport.safeTransferFrom(citizen, otherCitizen, tokenId);
    }

    function test_RevertWhen_ApprovingACredential() public {
        uint256 tokenId = _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        vm.startPrank(citizen);
        vm.expectRevert(CityPassport.SoulboundApprovalNotAllowed.selector);
        passport.approve(otherCitizen, tokenId);

        vm.expectRevert(CityPassport.SoulboundApprovalNotAllowed.selector);
        passport.setApprovalForAll(otherCitizen, true);
        vm.stopPrank();
    }

    // -------------------------------------------------------------------------------------
    // Revocation
    // -------------------------------------------------------------------------------------

    function test_IssuingInstitutionCanRevoke() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        vm.prank(library_);
        passport.revokeCredential(citizen, LIBRARY_VISIT);

        assertFalse(passport.hasCredential(citizen, LIBRARY_VISIT), "a revoked credential must not count");
        assertTrue(passport.getCredential(citizen, LIBRARY_VISIT).revoked);
        assertEq(passport.balanceOf(citizen), 1, "the token is kept so the history stays auditable");
    }

    function test_RevertWhen_AnotherInstitutionRevokes() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        vm.prank(scienceCenter);
        vm.expectRevert(CityPassport.NotCredentialIssuer.selector);
        passport.revokeCredential(citizen, LIBRARY_VISIT);
    }

    function test_AdminCanRevoke() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        vm.prank(admin);
        passport.revokeCredential(citizen, LIBRARY_VISIT);
        assertFalse(passport.hasCredential(citizen, LIBRARY_VISIT));
    }

    function test_EarningAgainAfterRevocationRestoresTheCredential() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        vm.prank(library_);
        passport.revokeCredential(citizen, LIBRARY_VISIT);
        assertFalse(passport.hasCredential(citizen, LIBRARY_VISIT));

        vm.warp(block.timestamp + 1 days);
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));

        assertTrue(passport.hasCredential(citizen, LIBRARY_VISIT));
        assertEq(passport.credentialCount(citizen), 1);
    }

    function test_RevertWhen_RevokingSomethingThatWasNeverIssued() public {
        vm.prank(library_);
        vm.expectRevert(CityPassport.CredentialNotFound.selector);
        passport.revokeCredential(citizen, LIBRARY_VISIT);
    }

    // -------------------------------------------------------------------------------------
    // Composability: one institution builds on another institution's word
    // -------------------------------------------------------------------------------------

    function test_MunicipalityIssuesYoungScientistOnTopOfOtherInstitutionsCredentials() public {
        bytes32[] memory required = new bytes32[](2);
        required[0] = LIBRARY_VISIT;
        required[1] = EARTHQUAKE_EXPERIENCE;

        assertFalse(passport.hasAllCredentials(citizen, required));

        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));
        _relay(scienceCenterPk, _claim(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, 0));

        assertTrue(passport.hasAllCredentials(citizen, required), "prerequisites are checked on-chain");

        _relay(municipalityPk, _claim(citizen, municipality, YOUNG_SCIENTIST, 0));

        assertTrue(passport.hasCredential(citizen, YOUNG_SCIENTIST));
        assertEq(passport.getCredential(citizen, YOUNG_SCIENTIST).issuer, municipality);
        assertEq(passport.credentialCount(citizen), 3);
    }

    function test_GetCredentialsReturnsTheWholePassport() public {
        _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));
        _relay(scienceCenterPk, _claim(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, 0));

        CityPassport.Credential[] memory credentials = passport.getCredentials(citizen);
        assertEq(credentials.length, 2);
        assertEq(credentials[0].credentialType, LIBRARY_VISIT);
        assertEq(credentials[0].issuer, library_);
        assertEq(credentials[1].credentialType, EARTHQUAKE_EXPERIENCE);
        assertEq(credentials[1].issuer, scienceCenter);
    }

    // -------------------------------------------------------------------------------------
    // Direct issuance path
    // -------------------------------------------------------------------------------------

    function test_RevertWhen_DirectIssuanceIsCalledWithoutTheRole() public {
        vm.prank(impostor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                impostor,
                CREDENTIAL_ISSUER_ROLE
            )
        );
        passport.issueCredentialFor(citizen, library_, LIBRARY_VISIT);
    }

    function test_RevertWhen_DirectIssuanceNamesAnUnauthorizedInstitution() public {
        address trustedContract = makeAddr("trusted-contract");
        vm.prank(admin);
        passport.grantRole(CREDENTIAL_ISSUER_ROLE, trustedContract);

        vm.prank(trustedContract);
        vm.expectRevert(abi.encodeWithSelector(CityPassport.UnauthorizedInstitution.selector, impostor));
        passport.issueCredentialFor(citizen, impostor, LIBRARY_VISIT);
    }

    // -------------------------------------------------------------------------------------
    // Metadata
    // -------------------------------------------------------------------------------------

    function test_TokenUriUsesTheConfiguredBase() public {
        uint256 tokenId = _relay(libraryPk, _claim(citizen, library_, LIBRARY_VISIT, _today()));
        assertEq(
            passport.tokenURI(tokenId),
            string.concat("https://cityquest.local/api/credential/", vm.toString(tokenId))
        );
    }

    function test_TokenIdIsDeterministic() public view {
        assertEq(
            passport.tokenIdFor(citizen, LIBRARY_VISIT),
            uint256(keccak256(abi.encode(citizen, LIBRARY_VISIT)))
        );
    }
}
