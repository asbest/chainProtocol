const crypto = require('crypto');
const pako = require('pako');

class Block {
    constructor(index, timestamp, data, previousHash = '') {
        this.index = index;
        this.timestamp = timestamp;
        this.data = data;
        this.previousHash = previousHash;
        this.hash = this.calculateHash(); // This will be called only when a new block is created
    }

    calculateHash() {
        return crypto.createHash('sha256').update(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data)).digest('hex');
    }
}

class Blockchain {
    constructor() {
        this.chain = [this.createGenesisBlock()];
    }

    createGenesisBlock() {
        return new Block(0, Date.now(), "Genesis Block", "0");
    }

    getLatestBlock() {
        return this.chain[this.chain.length - 1];
    }

    addBlock(newBlock) {
        newBlock.previousHash = this.getLatestBlock().hash;
        newBlock.hash = newBlock.calculateHash();
        this.chain.push(newBlock);
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

    save() {
        const json = JSON.stringify(this.chain);
        const compressed = pako.deflate(json, { to: 'string' });
        return compressed;
    }

    static load(compressed) {
        const json = pako.inflate(compressed, { to: 'string' });
        const chainData = JSON.parse(json);
        const blockchain = new Blockchain();
        blockchain.chain = chainData.map(blockData => {
            const block = new Block(blockData.index, blockData.timestamp, blockData.data, blockData.previousHash);
            block.hash = blockData.hash; // Explicitly set the loaded hash
            return block;
        });
        return blockchain;
    }
}

function generateBlock(data) {
    const lastBlock = this.getLatestBlock();
    const newBlock = new Block(lastBlock.index + 1, Date.now(), data, lastBlock.hash);
    this.addBlock(newBlock);
    return newBlock;
}

function getObjectFromBlock(block) {
    return block.data;
}

module.exports = {
    Blockchain,
    Block,
    generateBlock,
    getObjectFromBlock
};
