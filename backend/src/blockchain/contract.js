const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

// Integration boundary: the blockchain team exports ABI + deployed address here.
const CONTRACT_FILE = path.resolve(__dirname, '../../shared/DocumentRegistry.json');

let provider = null;
let contract = null;
let loadedContractAddress = null;

function loadContract() {
  try {
    if (!fs.existsSync(CONTRACT_FILE)) {
      console.warn('[CHAIN] DocumentRegistry.json not found — blockchain features unavailable');
      contract = null;
      loadedContractAddress = null;
      return null;
    }

    const raw = fs.readFileSync(CONTRACT_FILE, 'utf8');
    const config = JSON.parse(raw);
    const { abi, address } = config;

    if (!Array.isArray(abi) || abi.length === 0 || !address) {
      console.warn('[CHAIN] DocumentRegistry.json has no usable ABI/address');
      contract = null;
      loadedContractAddress = null;
      return null;
    }

    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    const privateKey = process.env.BLOCKCHAIN_PRIVATE_KEY;

    if (!privateKey) {
      console.warn('[CHAIN] BLOCKCHAIN_PRIVATE_KEY is not set — blockchain writes unavailable');
      contract = null;
      loadedContractAddress = null;
      return null;
    }

    // Reuse the provider unless the RPC URL changes.
    if (!provider || provider._getConnection?.().url !== rpcUrl) {
      provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    const signer = new ethers.Wallet(privateKey, provider);
    contract = new ethers.Contract(address, abi, signer);
    loadedContractAddress = address;

    return contract;
  } catch (err) {
    console.error('[CHAIN] Failed to load contract:', err.message);
    contract = null;
    loadedContractAddress = null;
    return null;
  }
}

function getContract() {
  // Reload the JSON on every call so a fresh Hardhat deployment is picked up.
  return loadContract();
}

async function registerDocument(docId, docHash, uploaderId) {
  const c = getContract();
  if (!c) return null;

  try {
    const tx = await c.registerDocument(docId, docHash, uploaderId);
    await tx.wait();
    return { txHash: tx.hash };
  } catch (err) {
    console.error('[CHAIN] registerDocument failed:', err.message);
    return null;
  }
}

async function verifyDocument(docId, currentHash) {
  const c = getContract();
  if (!c) return null;

  try {
    const [verified, onChainHash] = await c.verifyDocument(docId, currentHash);
    return {
      verified: Boolean(verified),
      onChainHash: String(onChainHash),
    };
  } catch (err) {
    console.error('[CHAIN] verifyDocument failed:', err.message);
    return null;
  }
}

async function addVersion(docId, newHash, reason, updatedBy) {
  const c = getContract();
  if (!c) return null;

  try {
    const tx = await c.addVersion(docId, newHash, reason, updatedBy);
    await tx.wait();
    return { txHash: tx.hash };
  } catch (err) {
    console.error('[CHAIN] addVersion failed:', err.message);
    return null;
  }
}

async function logAccess(docId, userId, action) {
  const allowedActions = new Set(['view', 'download', 'share']);
  if (!allowedActions.has(action)) {
    console.warn(`[CHAIN] Skipping unsupported access action: ${action}`);
    return null;
  }

  const c = getContract();
  if (!c) return null;

  try {
    const tx = await c.logAccess(docId, userId, action);
    await tx.wait();
    return { txHash: tx.hash };
  } catch (err) {
    console.error('[CHAIN] logAccess failed:', err.message);
    return null;
  }
}

/**
 * The Solidity function returns TWO arrays:
 *   [Version[], AccessLog[]]
 *
 * The backend API expects one flat array of:
 *   { action, userId, timestamp }
 *
 * Convert both arrays here so route/frontend code does not need to know
 * the Solidity tuple layout.
 */
async function getDocumentHistory(docId) {
  const c = getContract();
  if (!c) return null;

  try {
    const result = await c.getDocumentHistory(docId);
    const versions = result[0] || [];
    const accessLogs = result[1] || [];

    const history = [];

    for (const version of versions) {
      const versionNumber = Number(version.version ?? version[0]);
      const updatedBy = String(version.updatedBy ?? version[3] ?? '');
      const timestampValue = version.timestamp ?? version[4];

      history.push({
        action: versionNumber === 1 ? 'registered' : 'version_added',
        userId: updatedBy,
        timestamp: timestampValue
          ? new Date(Number(timestampValue) * 1000).toISOString()
          : '',
      });
    }

    for (const entry of accessLogs) {
      const userId = String(entry.userId ?? entry[0] ?? '');
      const action = String(entry.action ?? entry[1] ?? '');
      const timestampValue = entry.timestamp ?? entry[2];

      history.push({
        action,
        userId,
        timestamp: timestampValue
          ? new Date(Number(timestampValue) * 1000).toISOString()
          : '',
      });
    }

    history.sort((a, b) => {
      const aTime = a.timestamp ? Date.parse(a.timestamp) : 0;
      const bTime = b.timestamp ? Date.parse(b.timestamp) : 0;
      return aTime - bTime;
    });

    return history;
  } catch (err) {
    console.error('[CHAIN] getDocumentHistory failed:', err.message);
    return null;
  }
}

module.exports = {
  registerDocument,
  verifyDocument,
  addVersion,
  logAccess,
  getDocumentHistory,
};
