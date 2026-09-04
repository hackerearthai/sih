const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');

const CONTRACT_FILE = path.resolve(__dirname, '../../shared/DocumentRegistry.json');

let provider = null;
let contract = null;

/**
 * (Re-)load the contract ABI + address from the shared JSON file.
 * Called lazily on every request so the backend picks up redeployments
 * without a restart (important after `npx hardhat node` restarts).
 */
function loadContract() {
  try {
    if (!fs.existsSync(CONTRACT_FILE)) {
      console.warn('[CHAIN] shared/DocumentRegistry.json not found — blockchain features disabled');
      contract = null;
      return null;
    }

    const raw = fs.readFileSync(CONTRACT_FILE, 'utf-8');
    const { abi, address } = JSON.parse(raw);

    if (!abi || !address) {
      console.warn('[CHAIN] DocumentRegistry.json missing abi or address');
      contract = null;
      return null;
    }

    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || 'http://127.0.0.1:8545';
    provider = new ethers.JsonRpcProvider(rpcUrl);

    // Use the first Hardhat default account as signer
    const signer = new ethers.Wallet(
      // Hardhat's default account #0 private key
      '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80',
      provider,
    );

    contract = new ethers.Contract(address, abi, signer);
    return contract;
  } catch (err) {
    console.error('[CHAIN] Failed to load contract:', err.message);
    contract = null;
    return null;
  }
}

/** Get the contract instance (lazy-loads / reloads each call). */
function getContract() {
  return loadContract();
}

// ─── Exported helpers ───────────────────────────────────────

/**
 * Register a new document on-chain.
 * @returns {{ txHash: string } | null}
 */
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

/**
 * Verify a document's hash against the on-chain record.
 * @returns {{ verified: boolean, onChainHash: string } | null}
 */
async function verifyDocument(docId, currentHash) {
  const c = getContract();
  if (!c) return null;
  try {
    const result = await c.verifyDocument(docId, currentHash);
    // Solidity may return a tuple (bool verified, string onChainHash)
    // or the contract may just return bool — adapt to your ABI
    if (typeof result === 'boolean') {
      return { verified: result, onChainHash: 'N/A' };
    }
    // Assuming the contract returns [bool, string]
    return { verified: result[0], onChainHash: result[1] };
  } catch (err) {
    console.error('[CHAIN] verifyDocument failed:', err.message);
    return null;
  }
}

/**
 * Add a new version of a document on-chain.
 * @returns {{ txHash: string } | null}
 */
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

/**
 * Log an access event on-chain.
 * @returns {{ txHash: string } | null}
 */
async function logAccess(docId, userId, action) {
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
 * Get full document history from the chain (versions + access logs).
 * @returns {Array | null}
 */
async function getDocumentHistory(docId) {
  const c = getContract();
  if (!c) return null;
  try {
    const history = await c.getDocumentHistory(docId);
    // Convert ethers Result objects to plain JS
    return history.map((entry) => ({
      action:    entry.action    || entry[2] || '',
      userId:    entry.userId    || entry[1] || '',
      timestamp: entry.timestamp
        ? new Date(Number(entry.timestamp) * 1000).toISOString()
        : entry[3]
          ? new Date(Number(entry[3]) * 1000).toISOString()
          : '',
    }));
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
