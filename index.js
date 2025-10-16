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

module.exports = {
  Blockchain,
  Block,
  generateBlock,       // Helper
  getObjectFromBlock
};
