const fs = require("fs");
const path = require("path");
const { ethers } = require("ethers");

const CONTRACT_FILE = path.resolve(__dirname, "../../shared/DocumentRegistry.json");
let contract = null;
let provider = null;
let signer = null;
let initError = null;

function initBlockchain() {
  if (contract) return contract;
  try {
    if (!fs.existsSync(CONTRACT_FILE)) throw new Error(`Missing ${CONTRACT_FILE}`);
    const config = JSON.parse(fs.readFileSync(CONTRACT_FILE, "utf8"));
    if (!config.address || !Array.isArray(config.abi) || !config.abi.length) {
      throw new Error("DocumentRegistry.json has no deployed address/ABI.");
    }
    const rpcUrl = process.env.BLOCKCHAIN_RPC_URL || "http://127.0.0.1:8545";
    const key = process.env.BLOCKCHAIN_PRIVATE_KEY;
    if (!key) throw new Error("BLOCKCHAIN_PRIVATE_KEY is not set.");
    provider = new ethers.JsonRpcProvider(rpcUrl);
    signer = new ethers.Wallet(key, provider);
    contract = new ethers.Contract(config.address, config.abi, signer);
    initError = null;
    return contract;
  } catch (e) {
    initError = e;
    contract = null;
    return null;
  }
}

function requireContract() {
  const c = initBlockchain();
  if (!c) throw new Error(`Blockchain unavailable: ${initError?.message || "unknown error"}`);
  return c;
}

async function registerDocument(docId, docHash, uploaderId) {
  const tx = await requireContract().registerDocument(docId, docHash, uploaderId);
  const receipt = await tx.wait();
  return receipt.hash || tx.hash;
}

async function verifyDocument(docId, currentHash) {
  const [isValid, storedHash] = await requireContract().verifyDocument(docId, currentHash);
  return { isValid, storedHash };
}

async function addVersion(docId, newHash, reason, updatedBy) {
  const tx = await requireContract().addVersion(docId, newHash, reason, updatedBy);
  const receipt = await tx.wait();
  return receipt.hash || tx.hash;
}

async function logAccess(docId, userId, action) {
  if (!["view", "download", "share"].includes(action)) {
    throw new Error(`Invalid blockchain access action: ${action}`);
  }
  const tx = await requireContract().logAccess(docId, userId, action);
  const receipt = await tx.wait();
  return receipt.hash || tx.hash;
}

async function getDocumentHistory(docId) {
  const [versions, accessLogs] = await requireContract().getDocumentHistory(docId);
  const events = [
    ...versions.map(v => ({
      action: v.version === 1n ? "registered" : "version_added",
      version: Number(v.version),
      docHash: v.docHash,
      reason: v.reason,
      userId: v.updatedBy,
      timestamp: new Date(Number(v.timestamp) * 1000).toISOString()
    })),
    ...accessLogs.map(a => ({
      action: a.action,
      userId: a.userId,
      timestamp: new Date(Number(a.timestamp) * 1000).toISOString()
    }))
  ];
  return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
}

async function hasDocument(docId) {
  return await requireContract().hasDocument(docId);
}

module.exports = {
  registerDocument, verifyDocument, addVersion, logAccess,
  getDocumentHistory, hasDocument
};
