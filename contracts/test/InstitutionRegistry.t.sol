// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {IAccessControl} from "@openzeppelin/contracts/access/IAccessControl.sol";
import {CityQuestTest} from "./helpers/CityQuestTest.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";

contract InstitutionRegistryTest is CityQuestTest {
    address private museum = makeAddr("museum");

    function test_AdminCanRegisterInstitution() public {
        vm.prank(admin);
        registry.registerInstitution(museum, "Konya City Museum", InstitutionRegistry.InstitutionType.Museum);

        assertTrue(registry.isAuthorizedInstitution(museum));

        InstitutionRegistry.Institution memory institution = registry.getInstitution(museum);
        assertEq(institution.name, "Konya City Museum");
        assertEq(uint256(institution.kind), uint256(InstitutionRegistry.InstitutionType.Museum));
        assertTrue(institution.active);
        assertTrue(institution.registered);
    }

    function test_RevertWhen_NonRegistrarRegisters() public {
        vm.prank(impostor);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector, impostor, REGISTRAR_ROLE
            )
        );
        registry.registerInstitution(museum, "Fake Museum", InstitutionRegistry.InstitutionType.Museum);
    }

    function test_RevertWhen_RegisteringTwice() public {
        vm.startPrank(admin);
        registry.registerInstitution(museum, "Konya City Museum", InstitutionRegistry.InstitutionType.Museum);
        vm.expectRevert(
            abi.encodeWithSelector(InstitutionRegistry.InstitutionAlreadyRegistered.selector, museum)
        );
        registry.registerInstitution(museum, "Konya City Museum", InstitutionRegistry.InstitutionType.Museum);
        vm.stopPrank();
    }

    function test_UnknownAddressIsNotAuthorized() public view {
        assertFalse(registry.isAuthorizedInstitution(impostor));
        assertFalse(registry.isAuthorizedInstitution(citizen));
    }

    function test_DeactivateAndReactivate() public {
        assertTrue(registry.isAuthorizedInstitution(library_));

        vm.prank(admin);
        registry.deactivateInstitution(library_);
        assertFalse(registry.isAuthorizedInstitution(library_));

        vm.prank(admin);
        registry.reactivateInstitution(library_);
        assertTrue(registry.isAuthorizedInstitution(library_));
    }

    function test_RevertWhen_DeactivatingUnregistered() public {
        vm.prank(admin);
        vm.expectRevert(abi.encodeWithSelector(InstitutionRegistry.InstitutionNotRegistered.selector, museum));
        registry.deactivateInstitution(museum);
    }

    function test_RevertWhen_RegisteringZeroAddress() public {
        vm.prank(admin);
        vm.expectRevert(InstitutionRegistry.InvalidAccount.selector);
        registry.registerInstitution(address(0), "Nowhere", InstitutionRegistry.InstitutionType.Other);
    }

    function test_RevertWhen_NameIsEmpty() public {
        vm.prank(admin);
        vm.expectRevert(InstitutionRegistry.EmptyName.selector);
        registry.registerInstitution(museum, "", InstitutionRegistry.InstitutionType.Other);
    }

    function test_EnumerationListsEveryInstitution() public view {
        address[] memory accounts = registry.allInstitutions();
        assertEq(accounts.length, 3);
        assertEq(registry.institutionCount(), 3);
        assertEq(accounts[0], library_);
        assertEq(accounts[1], scienceCenter);
        assertEq(accounts[2], municipality);
        assertEq(registry.institutionAt(1), scienceCenter);
    }

    function test_AdminCanDelegateRegistrarRole() public {
        address deputy = makeAddr("deputy");

        vm.prank(admin);
        registry.grantRole(REGISTRAR_ROLE, deputy);

        vm.prank(deputy);
        registry.registerInstitution(museum, "Konya City Museum", InstitutionRegistry.InstitutionType.Museum);
        assertTrue(registry.isAuthorizedInstitution(museum));
    }

    function test_Rename() public {
        vm.prank(admin);
        registry.renameInstitution(library_, "Selcuklu Central Library");
        assertEq(registry.getInstitution(library_).name, "Selcuklu Central Library");
    }
}
