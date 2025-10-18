const crypto = require('crypto');
const pako = require('pako');

class Block {
  constructor(index, timestamp, data, previousHash = '') {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.hash = this.calculateHash();
  }

  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(
        String(this.index) +
        String(this.previousHash) +
        String(this.timestamp) +
        JSON.stringify(this.data)
      )
      .digest('hex');
  }
}

class Blockchain {
  constructor() {
    this.chain = [this.createGenesisBlock()];
  }

  createGenesisBlock() {
    return new Block(0, Date.now(), 'Genesis Block', '0');
  }

  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  addBlock(newBlock) {
    newBlock.previousHash = this.getLatestBlock().hash;
    newBlock.hash = newBlock.calculateHash();
    this.chain.push(newBlock);
  }

  // KORREKTUR: generateBlock als Klassenmethode
  generateBlock(data) {
    const lastBlock = this.getLatestBlock();
    const newBlock = new Block(
      lastBlock.index + 1,
      Date.now(),
      data,
      lastBlock.hash
    );
    this.addBlock(newBlock);
    return newBlock;
  }

  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      if (currentBlock.hash !== currentBlock.calculateHash()) {
        return false;
      }

      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }
    }
    return true;
  }

  // KORREKTUR: Base64 für robustes Speichern/Transport
  save() {
    const json = JSON.stringify(this.chain);
    const deflated = pako.deflate(json); // Uint8Array
    return Buffer.from(deflated).toString('base64');
  }

  static load(base64) {
    const buf = Buffer.from(base64, 'base64');
    const json = pako.inflate(buf, { to: 'string' });
    const chainData = JSON.parse(json);
    const blockchain = new Blockchain();
    blockchain.chain = chainData.map((blockData) => {
      const block = new Block(
        blockData.index,
        blockData.timestamp,
        blockData.data,
        blockData.previousHash
      );
      block.hash = blockData.hash; // geladene Hashes übernehmen
      return block;
    });
    return blockchain;
  }
}

// Optionaler Helper für Kompatibilität
function generateBlock(blockchain, data) {
  if (!blockchain || typeof blockchain.getLatestBlock !== 'function') {
    throw new TypeError('First argument must be a Blockchain instance');
  }
  return blockchain.generateBlock(data);
}

function getObjectFromBlock(block) {
  return block.data;
}

/**
 * Validate a state transition between two plain-state objects.
 *
 * Options (all optional):
 * - immutableKeys: array of keys that must not change (default: ['id'])
 * - allowDeletion: whether keys present in prevState may be deleted (default: false)
 * - numericIncreaseKeys: array of keys that must be non-decreasing numbers (default: [])
 * - customValidator: function(prevState, nextState) -> boolean | throws; if provided, its boolean result is used
 *
 * Returns: { valid: boolean, reasons: string[] }
 */
function isValidStateTransition(prevState, nextState, options = {}) {
  const reasons = [];
  const {
    immutableKeys = ['id'],
    allowDeletion = false,
    numericIncreaseKeys = [],
    customValidator
  } = options;

  if (prevState === null || nextState === null) {
    reasons.push('prevState and nextState must not be null');
    return { valid: false, reasons };
  }

  if (typeof prevState !== 'object' || Array.isArray(prevState) || typeof nextState !== 'object' || Array.isArray(nextState)) {
    reasons.push('prevState and nextState must be plain objects (not arrays)');
    return { valid: false, reasons };
  }

  // If a custom validator is provided, let it decide first.
  if (typeof customValidator === 'function') {
    try {
      const ok = customValidator(prevState, nextState);
      if (!ok) {
        reasons.push('customValidator returned false');
        return { valid: false, reasons };
      }
    } catch (e) {
      reasons.push('customValidator threw error: ' + (e && e.message ? e.message : String(e)));
      return { valid: false, reasons };
    }
  }

  // Immutable keys must not change if present in prevState
  for (const key of immutableKeys) {
    if (Object.prototype.hasOwnProperty.call(prevState, key)) {
      const prevVal = prevState[key];
      const nextHas = Object.prototype.hasOwnProperty.call(nextState, key);
      if (!nextHas) {
        reasons.push(`Immutable key "${key}" is missing in nextState`);
      } else {
        const nextVal = nextState[key];
        if (JSON.stringify(prevVal) !== JSON.stringify(nextVal)) {
          reasons.push(`Immutable key "${key}" changed from ${JSON.stringify(prevVal)} to ${JSON.stringify(nextVal)}`);
        }
      }
    }
  }

  // Deletion rules
  if (!allowDeletion) {
    for (const key of Object.keys(prevState)) {
      if (!Object.prototype.hasOwnProperty.call(nextState, key)) {
        reasons.push(`Key "${key}" was removed in nextState (deletions not allowed)`);
      }
    }
  }

  // Numeric-increase checks
  for (const key of numericIncreaseKeys) {
    if (Object.prototype.hasOwnProperty.call(prevState, key) && Object.prototype.hasOwnProperty.call(nextState, key)) {
      const prevVal = prevState[key];
      const nextVal = nextState[key];
      const prevNum = Number(prevVal);
      const nextNum = Number(nextVal);
      if (!Number.isFinite(prevNum) || !Number.isFinite(nextNum)) {
        reasons.push(`Key "${key}" must be a finite number for numericIncrease check`);
      } else if (nextNum < prevNum) {
        reasons.push(`Numeric key "${key}" decreased from ${prevNum} to ${nextNum}`);
      }
    }
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Validate whether the transition from prevBlock to nextBlock is valid.
 *
 * Checks performed by default:
 * - Both inputs are objects with required block fields: index, timestamp, data, previousHash, hash
 * - nextBlock.index === prevBlock.index + 1
 * - nextBlock.previousHash === prevBlock.hash
 * - nextBlock.hash matches the SHA256 of (index + previousHash + timestamp + JSON.stringify(data))
 * - Optionally verify prevBlock.hash matches its own recomputed hash (verifyPrevHash)
 * - Optionally disallow time travel: nextBlock.timestamp must be >= prevBlock.timestamp (unless allowTimeTravel)
 * - Optionally limit maxTimeDrift (in ms) between blocks
 *
 * Options:
 * - verifyPrevHash: boolean (default: true) - verify prevBlock.hash is correct
 * - allowTimeTravel: boolean (default: false) - allow next.timestamp < prev.timestamp
 * - maxTimeDrift: number|null (default: null) - if set, require next.timestamp - prev.timestamp <= maxTimeDrift
 *
 * Returns: { valid: boolean, reasons: string[] }
 */
function isValidBlockTransition(prevBlock, nextBlock, options = {}) {
  const reasons = [];
  const {
    verifyPrevHash = true,
    allowTimeTravel = false,
    maxTimeDrift = null
  } = options;

  // Basic presence checks
  function hasBlockShape(b) {
    return b && typeof b === 'object' &&
      Object.prototype.hasOwnProperty.call(b, 'index') &&
      Object.prototype.hasOwnProperty.call(b, 'timestamp') &&
      Object.prototype.hasOwnProperty.call(b, 'data') &&
      Object.prototype.hasOwnProperty.call(b, 'previousHash') &&
      Object.prototype.hasOwnProperty.call(b, 'hash');
  }

  if (!hasBlockShape(prevBlock)) {
    reasons.push('prevBlock is missing required block fields');
    return { valid: false, reasons };
  }
  if (!hasBlockShape(nextBlock)) {
    reasons.push('nextBlock is missing required block fields');
    return { valid: false, reasons };
  }

  // Helper to compute expected hash for a block-like object
  function computeHashForBlock(obj) {
    return crypto
      .createHash('sha256')
      .update(
        String(obj.index) +
        String(obj.previousHash) +
        String(obj.timestamp) +
        JSON.stringify(obj.data)
      )
      .digest('hex');
  }

  // Optionally verify prevBlock.hash is consistent
  if (verifyPrevHash) {
    const expectedPrevHash = computeHashForBlock(prevBlock);
    if (prevBlock.hash !== expectedPrevHash) {
      reasons.push(`prevBlock.hash is invalid (expected ${expectedPrevHash}, got ${prevBlock.hash})`);
    }
  }

  // Index progression
  const expectedIndex = Number(prevBlock.index) + 1;
  const nextIndex = Number(nextBlock.index);
  if (!Number.isFinite(nextIndex) || nextIndex !== expectedIndex) {
    reasons.push(`nextBlock.index must be prevBlock.index + 1 (expected ${expectedIndex}, got ${nextBlock.index})`);
  }

  // previousHash linkage
  if (nextBlock.previousHash !== prevBlock.hash) {
    reasons.push('nextBlock.previousHash does not match prevBlock.hash');
  }

  // Hash correctness for nextBlock
  const expectedNextHash = computeHashForBlock(nextBlock);
  if (nextBlock.hash !== expectedNextHash) {
    reasons.push(`nextBlock.hash is invalid (expected ${expectedNextHash}, got ${nextBlock.hash})`);
  }

  // Timestamp checks
  const prevTs = Number(prevBlock.timestamp);
  const nextTs = Number(nextBlock.timestamp);
  if (!Number.isFinite(prevTs) || !Number.isFinite(nextTs)) {
    reasons.push('timestamps must be numeric (ms since epoch)');
  } else {
    if (!allowTimeTravel && nextTs < prevTs) {
      reasons.push(`nextBlock.timestamp (${nextTs}) is before prevBlock.timestamp (${prevTs}) and time travel is not allowed`);
    }
    if (maxTimeDrift !== null) {
      const drift = nextTs - prevTs;
      if (drift > Number(maxTimeDrift)) {
        reasons.push(`time drift between blocks is too large: ${drift}ms (max allowed ${maxTimeDrift}ms)`);
      }
    }
  }

  return { valid: reasons.length === 0, reasons };
}

/**
 * Serialize a plain JavaScript object to a string and deserialize it back.
 *
 * serializeObject(obj, options)
 * - options.compress: boolean (default: false). If true, compresses with pako.deflate and returns base64 string.
 *
 * deserializeObject(str, options)
 * - options.compressed: boolean (default: false). If true, treats input as base64-compressed data and inflates it.
 *
 * For simple use cases you can call serializeObject(obj) and deserializeObject(jsonString).
 */
function serializeObject(obj, options = {}) {
  const { compress = false } = options;
  const json = JSON.stringify(obj);
  if (!compress) return json;
  const deflated = pako.deflate(json); // Uint8Array
  return Buffer.from(deflated).toString('base64');
}

function deserializeObject(str, options = {}) {
  const { compressed = false } = options;
  if (!compressed) return JSON.parse(str);
  const buf = Buffer.from(str, 'base64');
  const json = pako.inflate(buf, { to: 'string' });
  return JSON.parse(json);
}

module.exports = {
  Blockchain,
  Block,
  generateBlock,       // Helper
  getObjectFromBlock,
  isValidStateTransition,
  isValidBlockTransition,
  serializeObject,
  deserializeObject
};
