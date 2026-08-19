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
///      Only the deployer needs a funded account. It deploys the contracts, acts as the
///      municipality registrar, and relays every institution-signed transaction afterwards.
///      The institution signers never send transactions, so they never need gas.
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
            librarySigner, "Melikgazi Library", InstitutionRegistry.InstitutionType.Library
        );
        registry.registerInstitution(
            scienceCenterSigner, "Kayseri Science Center", InstitutionRegistry.InstitutionType.ScienceCenter
        );
        registry.registerInstitution(
            municipalitySigner, "Kayseri Municipality", InstitutionRegistry.InstitutionType.Municipality
        );

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
        console.log("");
        console.log("Institution signers hold no funds and need none: they sign, the relayer pays.");
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
