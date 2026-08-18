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
}
