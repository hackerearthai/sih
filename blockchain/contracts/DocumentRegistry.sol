// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/AccessControl.sol";

contract DocumentRegistry is AccessControl {
    bytes32 public constant UPLOADER_ROLE = keccak256("UPLOADER_ROLE");

    struct Version {
        uint256 version;
        string docHash;
        string reason;
        string updatedBy;
        uint256 timestamp;
    }

    struct AccessLog {
        string userId;
        string action;
        uint256 timestamp;
    }

    struct Document {
        string docId;
        string docHash;
        string uploaderId;
        uint256 timestamp;
        uint256 currentVersion;
        bool exists;
    }

    mapping(string => Document) private documents;
    mapping(string => Version[]) private versions;
    mapping(string => AccessLog[]) private accessLogs;

    event DocumentRegistered(
        string indexed docId,
        string docHash,
        string uploaderId,
        uint256 timestamp
    );

    event VersionAdded(
        string indexed docId,
        uint256 version,
        string docHash,
        string reason,
        string updatedBy,
        uint256 timestamp
    );

    event AccessLogged(
        string indexed docId,
        string userId,
        string action,
        uint256 timestamp
    );

    constructor(address admin) {
        require(admin != address(0), "Invalid admin");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(UPLOADER_ROLE, admin);
    }

    modifier documentExists(string memory docId) {
        require(documents[docId].exists, "Document does not exist");
        _;
    }

    function registerDocument(
        string calldata docId,
        string calldata docHash,
        string calldata uploaderId
    ) external onlyRole(UPLOADER_ROLE) {
        require(bytes(docId).length > 0, "docId required");
        require(bytes(docHash).length > 0, "docHash required");
        require(bytes(uploaderId).length > 0, "uploaderId required");
        require(!documents[docId].exists, "Document already exists");

        uint256 ts = block.timestamp;

        documents[docId] = Document({
            docId: docId,
            docHash: docHash,
            uploaderId: uploaderId,
            timestamp: ts,
            currentVersion: 1,
            exists: true
        });

        versions[docId].push(
            Version({
                version: 1,
                docHash: docHash,
                reason: "initial_registration",
                updatedBy: uploaderId,
                timestamp: ts
            })
        );

        emit DocumentRegistered(docId, docHash, uploaderId, ts);
    }

    function addVersion(
        string calldata docId,
        string calldata newDocHash,
        string calldata reason,
        string calldata updatedBy
    ) external onlyRole(UPLOADER_ROLE) documentExists(docId) {
        require(bytes(newDocHash).length > 0, "newDocHash required");
        require(bytes(reason).length > 0, "reason required");
        require(bytes(updatedBy).length > 0, "updatedBy required");

        uint256 nextVersion = documents[docId].currentVersion + 1;
        uint256 ts = block.timestamp;

        documents[docId].docHash = newDocHash;
        documents[docId].currentVersion = nextVersion;

        versions[docId].push(
            Version({
                version: nextVersion,
                docHash: newDocHash,
                reason: reason,
                updatedBy: updatedBy,
                timestamp: ts
            })
        );

        emit VersionAdded(
            docId,
            nextVersion,
            newDocHash,
            reason,
            updatedBy,
            ts
        );
    }

    function logAccess(
        string calldata docId,
        string calldata userId,
        string calldata action
    ) external documentExists(docId) {
        require(bytes(userId).length > 0, "userId required");
        require(
            keccak256(bytes(action)) == keccak256(bytes("view")) ||
            keccak256(bytes(action)) == keccak256(bytes("download")) ||
            keccak256(bytes(action)) == keccak256(bytes("share")),
            "Invalid action"
        );

        uint256 ts = block.timestamp;

        accessLogs[docId].push(
            AccessLog({
                userId: userId,
                action: action,
                timestamp: ts
            })
        );

        emit AccessLogged(docId, userId, action, ts);
    }

    function verifyDocument(
        string calldata docId,
        string calldata currentHash
    )
        external
        view
        documentExists(docId)
        returns (bool isValid, string memory storedHash)
    {
        storedHash = documents[docId].docHash;
        isValid = keccak256(bytes(currentHash)) == keccak256(bytes(storedHash));
    }

    function getDocumentHistory(
        string calldata docId
    )
        external
        view
        documentExists(docId)
        returns (
            Version[] memory allVersions,
            AccessLog[] memory allAccessLogs
        )
    {
        return (versions[docId], accessLogs[docId]);
    }

    function getDocument(
        string calldata docId
    ) external view documentExists(docId) returns (Document memory) {
        return documents[docId];
    }

    function hasDocument(string calldata docId) external view returns (bool) {
        return documents[docId].exists;
    }

    function grantUploaderRole(address account)
        external
        onlyRole(DEFAULT_ADMIN_ROLE)
    {
        grantRole(UPLOADER_ROLE, account);
    }
}
