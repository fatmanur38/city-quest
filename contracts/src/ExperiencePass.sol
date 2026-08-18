// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IInstitutionRegistry} from "./interfaces/IInstitutionRegistry.sol";
import {CityPassport} from "./CityPassport.sol";

/// @title ExperiencePass
/// @notice Single-use passes for experiences a citizen books in advance, such as the earthquake
///         simulation at a science center.
///
/// @dev Money is not the point here and never touches this contract. The ticket is paid for in
///      ordinary currency through ordinary payment infrastructure; what this contract provides
///      is the one property a paper ticket and a screenshot cannot: it can be spent exactly
///      once, and the science center can prove it was spent without phoning the seller.
///
///      Consuming a pass and awarding the achievement happen in the same transaction, so an
///      operator can never end up having burned someone's ticket without giving them credit
///      for the experience.
contract ExperiencePass is ERC721, AccessControl {
    using Strings for uint256;

    enum PassStatus {
        None,
        Valid,
        Used,
        Cancelled
    }

    struct Pass {
        address institution;
        /// @notice Credential minted into the passport when this pass is consumed.
        bytes32 credentialType;
        uint32 issuedAtDay;
        /// @notice Unix timestamp; 0 means the pass does not expire.
        uint64 validUntil;
        PassStatus status;
    }

    IInstitutionRegistry public immutable registry;
    CityPassport public immutable passport;

    uint256 private _nextPassId = 1;
    mapping(uint256 passId => Pass) private _passes;
    mapping(address holder => uint256[] passIds) private _passesOf;

    string private _baseTokenURI;

    event PassIssued(
        uint256 indexed passId,
        address indexed holder,
        address indexed institution,
        bytes32 credentialType
    );
    event PassConsumed(uint256 indexed passId, address indexed holder, address indexed institution);
    event PassCancelled(uint256 indexed passId, address indexed holder);
    event BaseURIUpdated(string baseURI);

    error UnauthorizedInstitution(address institution);
    error NotIssuingInstitution();
    error PassNotFound(uint256 passId);
    error PassNotValid(uint256 passId, PassStatus status);
    error PassExpired(uint256 passId, uint64 validUntil);
    error InvalidRecipient();
    error InvalidCredentialType();
    error SoulboundTransferNotAllowed();
    error SoulboundApprovalNotAllowed();

    modifier onlyAuthorizedInstitution() {
        if (!registry.isAuthorizedInstitution(msg.sender)) revert UnauthorizedInstitution(msg.sender);
        _;
    }

    constructor(address admin, address registryAddress, address passportAddress, string memory baseTokenURI)
        ERC721("City Experience Pass", "PASS")
    {
        if (admin == address(0) || registryAddress == address(0) || passportAddress == address(0)) {
            revert InvalidRecipient();
        }
        registry = IInstitutionRegistry(registryAddress);
        passport = CityPassport(passportAddress);
        _baseTokenURI = baseTokenURI;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Issue a pass after the citizen has paid, off-chain, in ordinary currency.
    function issuePass(address to, bytes32 credentialType, uint64 validUntil)
        external
        onlyAuthorizedInstitution
        returns (uint256 passId)
    {
        if (to == address(0)) revert InvalidRecipient();
        if (credentialType == bytes32(0)) revert InvalidCredentialType();

        passId = _nextPassId++;
        _passes[passId] = Pass({
            institution: msg.sender,
            credentialType: credentialType,
            issuedAtDay: uint32(block.timestamp / 1 days),
            validUntil: validUntil,
            status: PassStatus.Valid
        });
        _passesOf[to].push(passId);
        _safeMint(to, passId);

        emit PassIssued(passId, to, msg.sender, credentialType);
    }

    /// @notice Spend a pass at the door and award the achievement in the same breath.
    /// @dev Only the institution that issued the pass can consume it, so a museum cannot burn a
    ///      science center's tickets.
    function consumePass(uint256 passId) external onlyAuthorizedInstitution {
        Pass storage pass = _passes[passId];
        if (pass.status == PassStatus.None) revert PassNotFound(passId);
        if (pass.institution != msg.sender) revert NotIssuingInstitution();
        if (pass.status != PassStatus.Valid) revert PassNotValid(passId, pass.status);
        if (pass.validUntil != 0 && block.timestamp > pass.validUntil) {
            revert PassExpired(passId, pass.validUntil);
        }

        pass.status = PassStatus.Used;
        address holder = ownerOf(passId);

        emit PassConsumed(passId, holder, msg.sender);

        passport.issueCredentialFor(holder, msg.sender, pass.credentialType);
    }

    /// @notice Void an unused pass, for refunds or cancelled sessions.
    function cancelPass(uint256 passId) external {
        Pass storage pass = _passes[passId];
        if (pass.status == PassStatus.None) revert PassNotFound(passId);
        if (pass.institution != msg.sender && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotIssuingInstitution();
        }
        if (pass.status != PassStatus.Valid) revert PassNotValid(passId, pass.status);

        pass.status = PassStatus.Cancelled;
        emit PassCancelled(passId, ownerOf(passId));
    }

    // ---------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------

    function getPass(uint256 passId) external view returns (Pass memory) {
        return _passes[passId];
    }

    function passIdsOf(address holder) external view returns (uint256[] memory) {
        return _passesOf[holder];
    }

    /// @notice Ids and details together, so the tickets screen needs a single call.
    function getPasses(address holder)
        external
        view
        returns (uint256[] memory passIds, Pass[] memory passes)
    {
        passIds = _passesOf[holder];
        passes = new Pass[](passIds.length);
        for (uint256 i = 0; i < passIds.length; ++i) {
            passes[i] = _passes[passIds[i]];
        }
    }

    function nextPassId() external view returns (uint256) {
        return _nextPassId;
    }

    // ---------------------------------------------------------------------------------------
    // Soulbound behaviour
    // ---------------------------------------------------------------------------------------

    /// @dev A pass belongs to the person who bought it. Making it transferable would just build
    ///      a scalping market for children's museum tickets.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0) && to != address(0)) revert SoulboundTransferNotAllowed();
        return super._update(to, tokenId, auth);
    }

    function approve(address, uint256) public pure override {
        revert SoulboundApprovalNotAllowed();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert SoulboundApprovalNotAllowed();
    }

    // ---------------------------------------------------------------------------------------
    // Metadata & admin
    // ---------------------------------------------------------------------------------------

    function setBaseURI(string calldata baseTokenURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseTokenURI;
        emit BaseURIUpdated(baseTokenURI);
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return bytes(_baseTokenURI).length == 0 ? "" : string.concat(_baseTokenURI, tokenId.toString());
    }

    function supportsInterface(bytes4 interfaceId)
        public
        view
        override(ERC721, AccessControl)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
