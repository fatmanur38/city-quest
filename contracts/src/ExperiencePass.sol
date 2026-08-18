// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
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
///
///      Like CityPassport, the useful path here is signature-based: a venue signs an EIP-712
///      authorisation and any relayer submits it. That keeps one rule true everywhere in the
///      system -- institutions sign, a relayer pays -- so no institution has to hold or monitor
///      a gas balance. The direct msg.sender path is kept for a venue that would rather submit
///      its own transactions.
contract ExperiencePass is ERC721, EIP712, AccessControl {
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

    /// @notice What a venue signs to sell a ticket without sending a transaction.
    struct PassIssuance {
        address recipient;
        address institution;
        bytes32 credentialType;
        /// @notice How long the ticket itself is good for. 0 means it never expires.
        uint64 validUntil;
        /// @notice How long this authorisation is good for.
        uint64 expiresAt;
        bytes32 nonce;
    }

    /// @notice What a venue signs to admit someone at the door.
    struct ConsumeAuthorization {
        uint256 passId;
        address institution;
        uint64 expiresAt;
        bytes32 nonce;
    }

    bytes32 private constant PASS_ISSUANCE_TYPEHASH = keccak256(
        "PassIssuance(address recipient,address institution,bytes32 credentialType,uint64 validUntil,uint64 expiresAt,bytes32 nonce)"
    );

    bytes32 private constant CONSUME_AUTHORIZATION_TYPEHASH = keccak256(
        "ConsumeAuthorization(uint256 passId,address institution,uint64 expiresAt,bytes32 nonce)"
    );

    IInstitutionRegistry public immutable registry;
    CityPassport public immutable passport;

    uint256 private _nextPassId = 1;
    mapping(uint256 passId => Pass) private _passes;
    mapping(address holder => uint256[] passIds) private _passesOf;

    /// @dev Issuance needs its own replay guard, because nothing else would stop one signed
    ///     authorisation from minting an unlimited supply of tickets. Consumption does not: the
    ///     pass turns Used on first submission and can never become Valid again.
    mapping(bytes32 issuanceKey => bool spent) private _spentIssuances;

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
    error InvalidSignature();
    error AuthorizationExpired(uint64 expiresAt);
    error IssuanceAlreadyUsed(bytes32 issuanceKey);
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
        EIP712("CityQuest Experience", "1")
    {
        if (admin == address(0) || registryAddress == address(0) || passportAddress == address(0)) {
            revert InvalidRecipient();
        }
        registry = IInstitutionRegistry(registryAddress);
        passport = CityPassport(passportAddress);
        _baseTokenURI = baseTokenURI;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /// @notice Issue a pass directly, as the venue itself.
    /// @dev Requires the venue to hold gas. Most deployments use `issuePassSigned` instead.
    function issuePass(address to, bytes32 credentialType, uint64 validUntil)
        external
        onlyAuthorizedInstitution
        returns (uint256 passId)
    {
        return _issuePass(to, msg.sender, credentialType, validUntil);
    }

    /// @notice Issue a pass from a venue's signature, submitted by anyone.
    ///
    /// @dev This is the path the app uses. The venue signs after the citizen has paid, in
    ///      ordinary currency, through ordinary payment infrastructure; a relayer puts it
    ///      on-chain. The venue never needs a gas balance.
    function issuePassSigned(PassIssuance calldata issuance, bytes calldata signature)
        external
        returns (uint256 passId)
    {
        if (issuance.recipient == address(0)) revert InvalidRecipient();
        if (issuance.credentialType == bytes32(0)) revert InvalidCredentialType();
        if (block.timestamp > issuance.expiresAt) revert AuthorizationExpired(issuance.expiresAt);
        if (!registry.isAuthorizedInstitution(issuance.institution)) {
            revert UnauthorizedInstitution(issuance.institution);
        }

        bytes32 digest = hashIssuance(issuance);
        if (!SignatureChecker.isValidSignatureNow(issuance.institution, digest, signature)) {
            revert InvalidSignature();
        }

        // One signed authorisation sells exactly one ticket.
        bytes32 issuanceKey = keccak256(abi.encode(issuance.institution, issuance.nonce));
        if (_spentIssuances[issuanceKey]) revert IssuanceAlreadyUsed(issuanceKey);
        _spentIssuances[issuanceKey] = true;

        return _issuePass(
            issuance.recipient, issuance.institution, issuance.credentialType, issuance.validUntil
        );
    }

    function _issuePass(address to, address institution, bytes32 credentialType, uint64 validUntil)
        private
        returns (uint256 passId)
    {
        if (to == address(0)) revert InvalidRecipient();
        if (credentialType == bytes32(0)) revert InvalidCredentialType();

        passId = _nextPassId++;
        _passes[passId] = Pass({
            institution: institution,
            credentialType: credentialType,
            issuedAtDay: uint32(block.timestamp / 1 days),
            validUntil: validUntil,
            status: PassStatus.Valid
        });
        _passesOf[to].push(passId);
        _safeMint(to, passId);

        emit PassIssued(passId, to, institution, credentialType);
    }

    /// @notice Spend a pass at the door, as the venue itself.
    function consumePass(uint256 passId) external onlyAuthorizedInstitution {
        _consumePass(passId, msg.sender);
    }

    /// @notice Spend a pass from a venue's signature, submitted by anyone.
    /// @dev The authorisation needs no replay guard of its own: the pass becomes Used on the
    ///      first submission and can never return to Valid, so a second attempt reverts.
    function consumePassSigned(ConsumeAuthorization calldata authorization, bytes calldata signature)
        external
    {
        if (block.timestamp > authorization.expiresAt) {
            revert AuthorizationExpired(authorization.expiresAt);
        }
        if (!registry.isAuthorizedInstitution(authorization.institution)) {
            revert UnauthorizedInstitution(authorization.institution);
        }

        bytes32 digest = hashConsumeAuthorization(authorization);
        if (!SignatureChecker.isValidSignatureNow(authorization.institution, digest, signature)) {
            revert InvalidSignature();
        }

        _consumePass(authorization.passId, authorization.institution);
    }

    /// @dev Only the venue that issued a pass may spend it, so a museum cannot burn a science
    ///      center's tickets.
    function _consumePass(uint256 passId, address institution) private {
        Pass storage pass = _passes[passId];
        if (pass.status == PassStatus.None) revert PassNotFound(passId);
        if (pass.institution != institution) revert NotIssuingInstitution();
        if (pass.status != PassStatus.Valid) revert PassNotValid(passId, pass.status);
        if (pass.validUntil != 0 && block.timestamp > pass.validUntil) {
            revert PassExpired(passId, pass.validUntil);
        }

        pass.status = PassStatus.Used;
        address holder = ownerOf(passId);

        emit PassConsumed(passId, holder, institution);

        passport.issueCredentialFor(holder, institution, pass.credentialType);
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

    /// @notice The EIP-712 digest a venue signs to sell a ticket. Exposed so the backend and
    ///         the tests can prove they produce exactly what the contract will check.
    function hashIssuance(PassIssuance calldata issuance) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    PASS_ISSUANCE_TYPEHASH,
                    issuance.recipient,
                    issuance.institution,
                    issuance.credentialType,
                    issuance.validUntil,
                    issuance.expiresAt,
                    issuance.nonce
                )
            )
        );
    }

    /// @notice The EIP-712 digest a venue signs to admit someone at the door.
    function hashConsumeAuthorization(ConsumeAuthorization calldata authorization)
        public
        view
        returns (bytes32)
    {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    CONSUME_AUTHORIZATION_TYPEHASH,
                    authorization.passId,
                    authorization.institution,
                    authorization.expiresAt,
                    authorization.nonce
                )
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
    }

    function isIssuanceSpent(address institution, bytes32 nonce) external view returns (bool) {
        return _spentIssuances[keccak256(abi.encode(institution, nonce))];
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
