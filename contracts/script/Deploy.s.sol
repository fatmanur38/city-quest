// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {InstitutionRegistry} from "../src/InstitutionRegistry.sol";
import {CityPassport} from "../src/CityPassport.sol";
import {ExperiencePass} from "../src/ExperiencePass.sol";

/// @notice Deploys the three contracts and seeds the demo city.
///
/// @dev Local:
///        anvil
///        forge script script/Deploy.s.sol --rpc-url local --broadcast
///
///      Base Sepolia:
///        forge script script/Deploy.s.sol --rpc-url $BASE_SEPOLIA_RPC_URL --broadcast --verify
///
///      Writes deployments/<chainId>.json, which the web app reads to learn the addresses.
contract Deploy is Script {
    // Default institution signers are the standard Anvil accounts 1-3, so a local demo works
    // with no configuration at all. On a real network these must come from the environment.
    address constant ANVIL_LIBRARY = 0x70997970C51812dc3A010C7d01b50e0d17dc79C8;
    address constant ANVIL_SCIENCE_CENTER = 0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC;
    address constant ANVIL_MUNICIPALITY = 0x90F79bf6EB2c4f870365E785982E1f101E93b906;

    function run() external {
        uint256 deployerPk = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerPk);

        address librarySigner = vm.envOr("LIBRARY_SIGNER_ADDRESS", ANVIL_LIBRARY);
        address scienceCenterSigner = vm.envOr("SCIENCE_CENTER_SIGNER_ADDRESS", ANVIL_SCIENCE_CENTER);
        address municipalitySigner = vm.envOr("MUNICIPALITY_SIGNER_ADDRESS", ANVIL_MUNICIPALITY);
        string memory appUrl = vm.envOr("APP_BASE_URL", string("http://localhost:3000"));

        vm.startBroadcast(deployerPk);

        InstitutionRegistry registry = new InstitutionRegistry(deployer);

        CityPassport passport =
            new CityPassport(deployer, address(registry), string.concat(appUrl, "/api/metadata/credential/"));

        ExperiencePass experiencePass = new ExperiencePass(
            deployer, address(registry), address(passport), string.concat(appUrl, "/api/metadata/pass/")
        );

        // The pass contract awards the achievement in the same transaction that spends a ticket.
        passport.grantRole(passport.CREDENTIAL_ISSUER_ROLE(), address(experiencePass));

        registry.registerInstitution(
            librarySigner, "Selcuklu Library", InstitutionRegistry.InstitutionType.Library
        );
        registry.registerInstitution(
            scienceCenterSigner, "Konya Science Center", InstitutionRegistry.InstitutionType.ScienceCenter
        );
        registry.registerInstitution(
            municipalitySigner, "Konya Municipality", InstitutionRegistry.InstitutionType.Municipality
        );

        // Institutions send their own transactions when issuing and consuming tickets, so they
        // each need a little gas. On a public testnet the deployer tops them up here; on Anvil
        // they are already funded and this is a no-op.
        _fundIfNeeded(librarySigner);
        _fundIfNeeded(scienceCenterSigner);
        _fundIfNeeded(municipalitySigner);

        vm.stopBroadcast();

        _writeDeployment(address(registry), address(passport), address(experiencePass));

        console.log("");
        console.log("=== CityQuest deployed to chain %s ===", block.chainid);
        console.log("InstitutionRegistry  %s", address(registry));
        console.log("CityPassport         %s", address(passport));
        console.log("ExperiencePass       %s", address(experiencePass));
        console.log("Admin / relayer      %s", deployer);
        console.log("Library signer       %s", librarySigner);
        console.log("ScienceCenter signer %s", scienceCenterSigner);
        console.log("Municipality signer  %s", municipalitySigner);
    }

    /// @dev Institutions pay gas only for ticket issuance and consumption. Credential issuance
    ///      is signed by them but submitted by the relayer, so citizens never need funds at all.
    uint256 constant INSTITUTION_GAS_TOPUP = 0.02 ether;

    function _fundIfNeeded(address institution) private {
        if (institution.balance >= INSTITUTION_GAS_TOPUP) return;
        if (msg.sender.balance < INSTITUTION_GAS_TOPUP * 2) {
            console.log("WARNING: deployer too poor to fund %s", institution);
            return;
        }
        (bool sent,) = institution.call{value: INSTITUTION_GAS_TOPUP}("");
        if (sent) console.log("Funded institution %s", institution);
    }

    function _writeDeployment(address registry, address passport, address experiencePass) private {
        string memory json = "deployment";
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "institutionRegistry", registry);
        vm.serializeAddress(json, "cityPassport", passport);
        string memory out = vm.serializeAddress(json, "experiencePass", experiencePass);
        vm.writeJson(out, string.concat("./deployments/", vm.toString(block.chainid), ".json"));
    }
}
