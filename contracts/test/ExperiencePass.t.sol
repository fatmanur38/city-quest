// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {CityQuestTest} from "./helpers/CityQuestTest.sol";
import {ExperiencePass} from "../src/ExperiencePass.sol";
import {CityPassport} from "../src/CityPassport.sol";

contract ExperiencePassTest is CityQuestTest {
    uint64 private validUntil;

    function setUp() public override {
        super.setUp();
        validUntil = uint64(block.timestamp + 30 days);
    }

    function _issueTicket() private returns (uint256 passId) {
        vm.prank(scienceCenter);
        return experiencePass.issuePass(citizen, EARTHQUAKE_EXPERIENCE, validUntil);
    }

    // -------------------------------------------------------------------------------------
    // Issuing
    // -------------------------------------------------------------------------------------

    function test_AuthorizedInstitutionIssuesTicket() public {
        uint256 passId = _issueTicket();

        assertEq(experiencePass.ownerOf(passId), citizen);

        ExperiencePass.Pass memory pass = experiencePass.getPass(passId);
        assertEq(uint256(pass.status), uint256(ExperiencePass.PassStatus.Valid));
        assertEq(pass.institution, scienceCenter);
        assertEq(pass.credentialType, EARTHQUAKE_EXPERIENCE);
        assertEq(pass.validUntil, validUntil);
    }

    function test_RevertWhen_UnauthorizedAddressIssuesTicket() public {
        vm.prank(impostor);
        vm.expectRevert(abi.encodeWithSelector(ExperiencePass.UnauthorizedInstitution.selector, impostor));
        experiencePass.issuePass(citizen, EARTHQUAKE_EXPERIENCE, validUntil);
    }

    function test_RevertWhen_DeactivatedInstitutionIssuesTicket() public {
        vm.prank(admin);
        registry.deactivateInstitution(scienceCenter);

        vm.prank(scienceCenter);
        vm.expectRevert(
            abi.encodeWithSelector(ExperiencePass.UnauthorizedInstitution.selector, scienceCenter)
        );
        experiencePass.issuePass(citizen, EARTHQUAKE_EXPERIENCE, validUntil);
    }

    function test_TicketsAreListedForTheHolder() public {
        uint256 first = _issueTicket();
        vm.prank(scienceCenter);
        uint256 second = experiencePass.issuePass(citizen, keccak256("PLANETARIUM"), validUntil);

        (uint256[] memory ids, ExperiencePass.Pass[] memory passes) = experiencePass.getPasses(citizen);
        assertEq(ids.length, 2);
        assertEq(ids[0], first);
        assertEq(ids[1], second);
        assertEq(passes[0].credentialType, EARTHQUAKE_EXPERIENCE);
        assertEq(passes[1].credentialType, keccak256("PLANETARIUM"));
    }

    // -------------------------------------------------------------------------------------
    // Consuming: the core anti-reuse property
    // -------------------------------------------------------------------------------------

    function test_ConsumingTicketMarksItUsedAndAwardsTheAchievement() public {
        uint256 passId = _issueTicket();
        assertFalse(passport.hasCredential(citizen, EARTHQUAKE_EXPERIENCE));

        vm.prank(scienceCenter);
        experiencePass.consumePass(passId);

        assertEq(
            uint256(experiencePass.getPass(passId).status), uint256(ExperiencePass.PassStatus.Used)
        );
        assertTrue(passport.hasCredential(citizen, EARTHQUAKE_EXPERIENCE));
        assertEq(passport.getCredential(citizen, EARTHQUAKE_EXPERIENCE).issuer, scienceCenter);
    }

    /// @dev A screenshot of the ticket QR is worth nothing the second time.
    function test_RevertWhen_TicketIsConsumedTwice() public {
        uint256 passId = _issueTicket();

        vm.startPrank(scienceCenter);
        experiencePass.consumePass(passId);

        vm.expectRevert(
            abi.encodeWithSelector(
                ExperiencePass.PassNotValid.selector, passId, ExperiencePass.PassStatus.Used
            )
        );
        experiencePass.consumePass(passId);
        vm.stopPrank();
    }

    function test_RevertWhen_AnotherInstitutionConsumesTheTicket() public {
        uint256 passId = _issueTicket();

        vm.prank(library_);
        vm.expectRevert(ExperiencePass.NotIssuingInstitution.selector);
        experiencePass.consumePass(passId);
    }

    function test_RevertWhen_UnauthorizedAddressConsumesTheTicket() public {
        uint256 passId = _issueTicket();

        vm.prank(impostor);
        vm.expectRevert(abi.encodeWithSelector(ExperiencePass.UnauthorizedInstitution.selector, impostor));
        experiencePass.consumePass(passId);
    }

    function test_RevertWhen_TicketDoesNotExist() public {
        vm.prank(scienceCenter);
        vm.expectRevert(abi.encodeWithSelector(ExperiencePass.PassNotFound.selector, uint256(999)));
        experiencePass.consumePass(999);
    }

    function test_RevertWhen_TicketHasExpired() public {
        uint256 passId = _issueTicket();
        vm.warp(validUntil + 1);

        vm.prank(scienceCenter);
        vm.expectRevert(abi.encodeWithSelector(ExperiencePass.PassExpired.selector, passId, validUntil));
        experiencePass.consumePass(passId);
    }

    function test_TicketWithoutExpiryStaysValid() public {
        vm.prank(scienceCenter);
        uint256 passId = experiencePass.issuePass(citizen, EARTHQUAKE_EXPERIENCE, 0);

        vm.warp(block.timestamp + 3650 days);
        vm.prank(scienceCenter);
        experiencePass.consumePass(passId);

        assertEq(uint256(experiencePass.getPass(passId).status), uint256(ExperiencePass.PassStatus.Used));
    }

    // -------------------------------------------------------------------------------------
    // Cancelling
    // -------------------------------------------------------------------------------------

    function test_RevertWhen_ConsumingACancelledTicket() public {
        uint256 passId = _issueTicket();

        vm.prank(scienceCenter);
        experiencePass.cancelPass(passId);

        vm.prank(scienceCenter);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExperiencePass.PassNotValid.selector, passId, ExperiencePass.PassStatus.Cancelled
            )
        );
        experiencePass.consumePass(passId);

        assertFalse(passport.hasCredential(citizen, EARTHQUAKE_EXPERIENCE));
    }

    function test_RevertWhen_AnotherInstitutionCancelsTheTicket() public {
        uint256 passId = _issueTicket();

        vm.prank(library_);
        vm.expectRevert(ExperiencePass.NotIssuingInstitution.selector);
        experiencePass.cancelPass(passId);
    }

    // -------------------------------------------------------------------------------------
    // Soulbound behaviour
    // -------------------------------------------------------------------------------------

    function test_RevertWhen_TicketIsTransferred() public {
        uint256 passId = _issueTicket();

        vm.prank(citizen);
        vm.expectRevert(ExperiencePass.SoulboundTransferNotAllowed.selector);
        experiencePass.transferFrom(citizen, otherCitizen, passId);
    }

    function test_RevertWhen_TicketIsApproved() public {
        uint256 passId = _issueTicket();

        vm.prank(citizen);
        vm.expectRevert(ExperiencePass.SoulboundApprovalNotAllowed.selector);
        experiencePass.approve(otherCitizen, passId);
    }

    // -------------------------------------------------------------------------------------
    // The link into the passport contract
    // -------------------------------------------------------------------------------------

    function test_RevertWhen_PassContractLosesItsIssuerRole() public {
        uint256 passId = _issueTicket();

        vm.prank(admin);
        passport.revokeRole(CREDENTIAL_ISSUER_ROLE, address(experiencePass));

        vm.prank(scienceCenter);
        vm.expectRevert();
        experiencePass.consumePass(passId);

        // The ticket must survive a failed consumption rather than being silently burned.
        assertEq(uint256(experiencePass.getPass(passId).status), uint256(ExperiencePass.PassStatus.Valid));
    }

    function test_ConsumingTwoTicketsForTheSameExperienceYieldsOneBadge() public {
        uint256 first = _issueTicket();
        uint256 second = _issueTicket();

        vm.startPrank(scienceCenter);
        experiencePass.consumePass(first);
        experiencePass.consumePass(second);
        vm.stopPrank();

        assertEq(passport.credentialCount(citizen), 1);
    }

    // -------------------------------------------------------------------------------------
    // Relayed paths: the venue signs, anyone submits, nobody but the relayer holds gas
    // -------------------------------------------------------------------------------------

    function test_RelayerIssuesTicketFromVenueSignature() public {
        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, validUntil);
        bytes memory signature = _signIssuance(scienceCenterPk, issuance);

        vm.prank(relayer);
        uint256 passId = experiencePass.issuePassSigned(issuance, signature);

        assertEq(experiencePass.ownerOf(passId), citizen);
        ExperiencePass.Pass memory pass = experiencePass.getPass(passId);
        assertEq(pass.institution, scienceCenter, "the venue, not the relayer, issued this");
        assertEq(uint256(pass.status), uint256(ExperiencePass.PassStatus.Valid));
    }

    /// @dev The whole point of the change: no institution needs an ether balance.
    function test_VenueNeedsNoGasForTheSignedPaths() public {
        vm.deal(scienceCenter, 0);
        assertEq(scienceCenter.balance, 0);

        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, validUntil);
        vm.prank(relayer);
        uint256 passId = experiencePass.issuePassSigned(issuance, _signIssuance(scienceCenterPk, issuance));

        ExperiencePass.ConsumeAuthorization memory authorization = _consumeAuth(passId, scienceCenter);
        vm.prank(relayer);
        experiencePass.consumePassSigned(authorization, _signConsume(scienceCenterPk, authorization));

        assertEq(scienceCenter.balance, 0, "the venue spent nothing");
        assertEq(uint256(experiencePass.getPass(passId).status), uint256(ExperiencePass.PassStatus.Used));
        assertTrue(passport.hasCredential(citizen, EARTHQUAKE_EXPERIENCE));
    }

    function test_RevertWhen_IssuanceSignatureIsFromSomeoneElse() public {
        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, validUntil);
        bytes memory signature = _signIssuance(impostorPk, issuance);

        vm.prank(relayer);
        vm.expectRevert(ExperiencePass.InvalidSignature.selector);
        experiencePass.issuePassSigned(issuance, signature);
    }

    function test_RevertWhen_IssuanceNamesAnUnauthorizedVenue() public {
        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, impostor, EARTHQUAKE_EXPERIENCE, validUntil);
        bytes memory signature = _signIssuance(impostorPk, issuance);

        vm.prank(relayer);
        vm.expectRevert(abi.encodeWithSelector(ExperiencePass.UnauthorizedInstitution.selector, impostor));
        experiencePass.issuePassSigned(issuance, signature);
    }

    function test_RevertWhen_IssuanceIsTamperedWith() public {
        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, validUntil);
        bytes memory signature = _signIssuance(scienceCenterPk, issuance);

        issuance.recipient = impostor;

        vm.prank(relayer);
        vm.expectRevert(ExperiencePass.InvalidSignature.selector);
        experiencePass.issuePassSigned(issuance, signature);
    }

    function test_RevertWhen_IssuanceHasExpired() public {
        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, validUntil);
        bytes memory signature = _signIssuance(scienceCenterPk, issuance);

        vm.warp(issuance.expiresAt + 1);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(ExperiencePass.AuthorizationExpired.selector, issuance.expiresAt)
        );
        experiencePass.issuePassSigned(issuance, signature);
    }

    /// @dev Without this, one signed authorisation would be an unlimited ticket printer.
    function test_RevertWhen_TheSameIssuanceIsSubmittedTwice() public {
        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, validUntil);
        bytes memory signature = _signIssuance(scienceCenterPk, issuance);

        vm.startPrank(relayer);
        experiencePass.issuePassSigned(issuance, signature);

        bytes32 issuanceKey = keccak256(abi.encode(scienceCenter, issuance.nonce));
        vm.expectRevert(abi.encodeWithSelector(ExperiencePass.IssuanceAlreadyUsed.selector, issuanceKey));
        experiencePass.issuePassSigned(issuance, signature);
        vm.stopPrank();

        assertTrue(experiencePass.isIssuanceSpent(scienceCenter, issuance.nonce));
    }

    function test_RevertWhen_SignedConsumeIsReplayed() public {
        uint256 passId = _issueTicket();
        ExperiencePass.ConsumeAuthorization memory authorization = _consumeAuth(passId, scienceCenter);
        bytes memory signature = _signConsume(scienceCenterPk, authorization);

        vm.startPrank(relayer);
        experiencePass.consumePassSigned(authorization, signature);

        vm.expectRevert(
            abi.encodeWithSelector(
                ExperiencePass.PassNotValid.selector, passId, ExperiencePass.PassStatus.Used
            )
        );
        experiencePass.consumePassSigned(authorization, signature);
        vm.stopPrank();
    }

    function test_RevertWhen_AnotherVenueSignsTheConsume() public {
        uint256 passId = _issueTicket();
        // The library is a real, authorised institution -- it just did not sell this ticket.
        ExperiencePass.ConsumeAuthorization memory authorization = _consumeAuth(passId, library_);
        bytes memory signature = _signConsume(libraryPk, authorization);

        vm.prank(relayer);
        vm.expectRevert(ExperiencePass.NotIssuingInstitution.selector);
        experiencePass.consumePassSigned(authorization, signature);
    }

    function test_RevertWhen_ConsumeSignatureIsFromSomeoneElse() public {
        uint256 passId = _issueTicket();
        ExperiencePass.ConsumeAuthorization memory authorization = _consumeAuth(passId, scienceCenter);
        bytes memory signature = _signConsume(impostorPk, authorization);

        vm.prank(relayer);
        vm.expectRevert(ExperiencePass.InvalidSignature.selector);
        experiencePass.consumePassSigned(authorization, signature);
    }

    function test_RevertWhen_ConsumeAuthorizationHasExpired() public {
        uint256 passId = _issueTicket();
        ExperiencePass.ConsumeAuthorization memory authorization = _consumeAuth(passId, scienceCenter);
        bytes memory signature = _signConsume(scienceCenterPk, authorization);

        vm.warp(authorization.expiresAt + 1);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(
                ExperiencePass.AuthorizationExpired.selector, authorization.expiresAt
            )
        );
        experiencePass.consumePassSigned(authorization, signature);
    }

    function test_RevertWhen_SuspendedVenueSignsAnIssuance() public {
        vm.prank(admin);
        registry.deactivateInstitution(scienceCenter);

        ExperiencePass.PassIssuance memory issuance =
            _issuance(citizen, scienceCenter, EARTHQUAKE_EXPERIENCE, validUntil);
        bytes memory signature = _signIssuance(scienceCenterPk, issuance);

        vm.prank(relayer);
        vm.expectRevert(
            abi.encodeWithSelector(ExperiencePass.UnauthorizedInstitution.selector, scienceCenter)
        );
        experiencePass.issuePassSigned(issuance, signature);
    }
}
