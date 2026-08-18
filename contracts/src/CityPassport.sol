// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {SignatureChecker} from "@openzeppelin/contracts/utils/cryptography/SignatureChecker.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";
import {IInstitutionRegistry} from "./interfaces/IInstitutionRegistry.sol";

/// @title CityPassport
/// @notice A citizen's portable record of what they have learned and experienced across a city.
///
/// @dev Two things happen here, and it is worth being precise about the difference.
///
///      1. An *activity verification* is a one-shot record that an authorised institution
///         confirmed something happened. It is stored as a single boolean under an opaque hash.
///         It carries no wallet address, no venue, and no clock time in contract state.
///
///      2. A *credential* is the badge the citizen actually carries: a soulbound ERC-721 that
///         says "this address holds LIBRARY_VISITOR, issued by Selcuklu Library". It is minted
///         the first time a matching activity is verified and never duplicated after that, so
///         visiting the library every week for a year produces one badge, not fifty-two.
///
///      Institutions never send these transactions themselves. They sign an EIP-712 claim
///      off-chain and any relayer may submit it. That is what lets a twelve-year-old collect a
///      verified achievement without owning gas, seeing a wallet popup, or knowing that a
///      blockchain was involved at all.
contract CityPassport is ERC721, EIP712, AccessControl {
    using Strings for uint256;

    /// @notice Contracts allowed to issue credentials directly, bypassing signature checks
    ///         because they have already established authority themselves (see ExperiencePass).
    bytes32 public constant CREDENTIAL_ISSUER_ROLE = keccak256("CREDENTIAL_ISSUER_ROLE");

    /// @notice What an institution signs to confirm a citizen did something.
    /// @param recipient      Who earned it.
    /// @param institution    Who is vouching for it. Must be authorised in the registry.
    /// @param credentialType Achievement identifier, e.g. keccak256("LIBRARY_VISIT").
    /// @param periodId       Anti-abuse bucket. Day number for repeatable activities, 0 for
    ///                       one-time credentials. See `activityRecordKey`.
    /// @param expiresAt      Unix timestamp after which the signature is worthless.
    /// @param nonce          Random value, so a QR code containing a claim cannot be guessed
    ///                       ahead of time by someone standing outside the building.
    struct ActivityClaim {
        address recipient;
        address institution;
        bytes32 credentialType;
        uint64 periodId;
        uint64 expiresAt;
        bytes32 nonce;
    }

    bytes32 private constant ACTIVITY_CLAIM_TYPEHASH = keccak256(
        "ActivityClaim(address recipient,address institution,bytes32 credentialType,uint64 periodId,uint64 expiresAt,bytes32 nonce)"
    );

    struct Credential {
        address issuer;
        bytes32 credentialType;
        /// @dev Days since the Unix epoch, not seconds. Deliberately coarse: "Library Visitor
        ///      since March" is useful to show, "was at the library at 16:32" is surveillance.
        uint32 issuedAtDay;
        bool revoked;
        bool exists;
    }

    IInstitutionRegistry public immutable registry;

    mapping(uint256 tokenId => Credential) private _credentials;
    mapping(address holder => bytes32[] credentialTypes) private _heldTypes;

    /// @dev The whole anti-abuse mechanism: an opaque key that can only ever be spent once.
    mapping(bytes32 recordKey => bool spent) private _verifiedActivities;

    string private _baseTokenURI;

    /// @dev Events name the record key rather than the citizen. Anyone who already knows the
    ///      exact claim can confirm it; nobody can trawl the logs to reconstruct where a
    ///      particular child spent their afternoons.
    event ActivityVerified(bytes32 indexed recordKey, bytes32 indexed credentialType);
    event CredentialIssued(address indexed holder, bytes32 indexed credentialType, address indexed issuer);
    event CredentialRevoked(address indexed holder, bytes32 indexed credentialType, address indexed revokedBy);
    event BaseURIUpdated(string baseURI);

    error UnauthorizedInstitution(address institution);
    error InvalidSignature();
    error ClaimExpired(uint64 expiresAt);
    error ActivityAlreadyVerified(bytes32 recordKey);
    error InvalidRecipient();
    error InvalidCredentialType();
    error CredentialNotFound();
    error NotCredentialIssuer();
    error SoulboundTransferNotAllowed();
    error SoulboundApprovalNotAllowed();

    constructor(address admin, address registryAddress, string memory baseTokenURI)
        ERC721("City Learning Passport", "PASSPORT")
        EIP712("CityQuest Passport", "1")
    {
        if (admin == address(0) || registryAddress == address(0)) revert InvalidRecipient();
        registry = IInstitutionRegistry(registryAddress);
        _baseTokenURI = baseTokenURI;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    // ---------------------------------------------------------------------------------------
    // Issuance
    // ---------------------------------------------------------------------------------------

    /// @notice Submit an institution-signed claim. Callable by anyone, which is the point: the
    ///         citizen or a relayer pays the gas, while authority comes from the signature.
    /// @return tokenId The credential the recipient holds for this achievement type.
    function verifyActivity(ActivityClaim calldata claim, bytes calldata signature)
        external
        returns (uint256 tokenId)
    {
        if (claim.recipient == address(0)) revert InvalidRecipient();
        if (claim.credentialType == bytes32(0)) revert InvalidCredentialType();
        if (block.timestamp > claim.expiresAt) revert ClaimExpired(claim.expiresAt);
        if (!registry.isAuthorizedInstitution(claim.institution)) {
            revert UnauthorizedInstitution(claim.institution);
        }

        // SignatureChecker also accepts ERC-1271 signatures, so an institution can later move
        // from a single key to a multisig without redeploying anything.
        bytes32 digest = hashClaim(claim);
        if (!SignatureChecker.isValidSignatureNow(claim.institution, digest, signature)) {
            revert InvalidSignature();
        }

        // Replay protection. Note there is deliberately no separate "used nonce" mapping: the
        // nonce is inside the signed digest, so a signature is already bound to exactly one
        // claim. The record key is the stronger, semantic guarantee -- it stops a second claim
        // for the same person, place, achievement and day even if freshly signed.
        bytes32 recordKey =
            activityRecordKey(claim.recipient, claim.institution, claim.credentialType, claim.periodId);
        if (_verifiedActivities[recordKey]) revert ActivityAlreadyVerified(recordKey);
        _verifiedActivities[recordKey] = true;

        emit ActivityVerified(recordKey, claim.credentialType);

        return _issueCredential(claim.recipient, claim.institution, claim.credentialType);
    }

    /// @notice Direct issuance for trusted sibling contracts that have already verified
    ///         institutional authority (ExperiencePass, when a ticket is consumed).
    function issueCredentialFor(address to, address institution, bytes32 credentialType)
        external
        onlyRole(CREDENTIAL_ISSUER_ROLE)
        returns (uint256 tokenId)
    {
        if (to == address(0)) revert InvalidRecipient();
        if (credentialType == bytes32(0)) revert InvalidCredentialType();
        if (!registry.isAuthorizedInstitution(institution)) revert UnauthorizedInstitution(institution);
        return _issueCredential(to, institution, credentialType);
    }

    /// @dev Idempotent by design. Earning the same achievement again is a no-op, not an error,
    ///      so the daily-visit path and the badge path never fight each other.
    function _issueCredential(address to, address institution, bytes32 credentialType)
        private
        returns (uint256 tokenId)
    {
        tokenId = tokenIdFor(to, credentialType);
        Credential storage credential = _credentials[tokenId];

        if (credential.exists) {
            // Re-earning a revoked credential restores it, attributed to the new issuer.
            if (credential.revoked) {
                credential.revoked = false;
                credential.issuer = institution;
                credential.issuedAtDay = uint32(block.timestamp / 1 days);
                emit CredentialIssued(to, credentialType, institution);
            }
            return tokenId;
        }

        _credentials[tokenId] = Credential({
            issuer: institution,
            credentialType: credentialType,
            issuedAtDay: uint32(block.timestamp / 1 days),
            revoked: false,
            exists: true
        });
        _heldTypes[to].push(credentialType);
        _safeMint(to, tokenId);

        emit CredentialIssued(to, credentialType, institution);
    }

    // ---------------------------------------------------------------------------------------
    // Revocation
    // ---------------------------------------------------------------------------------------

    /// @notice Withdraw a credential. Only the institution that issued it, or an administrator,
    ///         may do this. The token is kept and flagged rather than burned, so the history
    ///         stays auditable.
    function revokeCredential(address holder, bytes32 credentialType) external {
        uint256 tokenId = tokenIdFor(holder, credentialType);
        Credential storage credential = _credentials[tokenId];
        if (!credential.exists) revert CredentialNotFound();
        if (msg.sender != credential.issuer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotCredentialIssuer();
        }
        credential.revoked = true;
        emit CredentialRevoked(holder, credentialType, msg.sender);
    }

    // ---------------------------------------------------------------------------------------
    // Views
    // ---------------------------------------------------------------------------------------

    /// @notice Deterministic token id, so any party can check a credential without an index.
    function tokenIdFor(address holder, bytes32 credentialType) public pure returns (uint256) {
        return uint256(keccak256(abi.encode(holder, credentialType)));
    }

    /// @notice The anti-abuse key. Same citizen + same institution + same achievement + same
    ///         day collapses to one value, so the second attempt that day cannot be spent.
    ///         `periodId == 0` means "one time ever", used for non-repeatable achievements.
    function activityRecordKey(
        address recipient,
        address institution,
        bytes32 credentialType,
        uint64 periodId
    ) public pure returns (bytes32) {
        return keccak256(abi.encode(recipient, institution, credentialType, periodId));
    }

    function isActivityVerified(bytes32 recordKey) external view returns (bool) {
        return _verifiedActivities[recordKey];
    }

    /// @notice True only for a credential that exists and has not been withdrawn. This is the
    ///         question a sponsor or another institution asks before trusting an achievement.
    function hasCredential(address holder, bytes32 credentialType) public view returns (bool) {
        Credential storage credential = _credentials[tokenIdFor(holder, credentialType)];
        return credential.exists && !credential.revoked;
    }

    /// @notice Batch form, so a quest can be checked in a single call.
    function hasAllCredentials(address holder, bytes32[] calldata credentialTypes)
        external
        view
        returns (bool)
    {
        for (uint256 i = 0; i < credentialTypes.length; ++i) {
            if (!hasCredential(holder, credentialTypes[i])) return false;
        }
        return true;
    }

    function getCredential(address holder, bytes32 credentialType)
        external
        view
        returns (Credential memory)
    {
        return _credentials[tokenIdFor(holder, credentialType)];
    }

    /// @notice Look a credential up by token id. Token ids are a hash of holder and type and
    ///         cannot be reversed, so metadata servers need this to describe a token.
    function credentialAt(uint256 tokenId) external view returns (Credential memory) {
        return _credentials[tokenId];
    }

    /// @notice Everything in a citizen's passport, in one call. Bounded by how many distinct
    ///         achievements exist in a city.
    function getCredentials(address holder) external view returns (Credential[] memory result) {
        bytes32[] storage types = _heldTypes[holder];
        result = new Credential[](types.length);
        for (uint256 i = 0; i < types.length; ++i) {
            result[i] = _credentials[tokenIdFor(holder, types[i])];
        }
    }

    function credentialCount(address holder) external view returns (uint256) {
        return _heldTypes[holder].length;
    }

    // ---------------------------------------------------------------------------------------
    // Soulbound behaviour
    // ---------------------------------------------------------------------------------------

    /// @dev Minting is allowed, transferring is not. An achievement that can be sold is not a
    ///      record of what someone learned, and this project is explicitly not a token market.
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

    function _baseURI() internal view override returns (string memory) {
        return _baseTokenURI;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return bytes(_baseTokenURI).length == 0 ? "" : string.concat(_baseTokenURI, tokenId.toString());
    }

    /// @notice The EIP-712 digest an institution signs. Exposed so the backend and the tests
    ///         can prove they are producing exactly what the contract will check.
    function hashClaim(ActivityClaim calldata claim) public view returns (bytes32) {
        return _hashTypedDataV4(
            keccak256(
                abi.encode(
                    ACTIVITY_CLAIM_TYPEHASH,
                    claim.recipient,
                    claim.institution,
                    claim.credentialType,
                    claim.periodId,
                    claim.expiresAt,
                    claim.nonce
                )
            )
        );
    }

    function domainSeparator() external view returns (bytes32) {
        return _domainSeparatorV4();
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
