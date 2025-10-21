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

  save() {
    const json = JSON.stringify(this.chain);
    const deflated = pako.deflate(json);
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
      block.hash = blockData.hash;
      return block;
    });
    return blockchain;
  }
}

function getObjectFromBlock(block) {
  return block.data;
}

function isValidBlockTransition(prevBlock, nextBlock, options = {}) {
    const reasons = [];
    const {
      verifyPrevHash = true,
      allowTimeTravel = false,
      maxTimeDrift = null
    } = options;
  
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
  
    if (verifyPrevHash) {
      const expectedPrevHash = computeHashForBlock(prevBlock);
      if (prevBlock.hash !== expectedPrevHash) {
        reasons.push(`prevBlock.hash is invalid (expected ${expectedPrevHash}, got ${prevBlock.hash})`);
      }
    }
  
    const expectedIndex = Number(prevBlock.index) + 1;
    const nextIndex = Number(nextBlock.index);
    if (!Number.isFinite(nextIndex) || nextIndex !== expectedIndex) {
      reasons.push(`nextBlock.index must be prevBlock.index + 1 (expected ${expectedIndex}, got ${nextBlock.index})`);
    }
  
    if (nextBlock.previousHash !== prevBlock.hash) {
      reasons.push('nextBlock.previousHash does not match prevBlock.hash');
    }
  
    const expectedNextHash = computeHashForBlock(nextBlock);
    if (nextBlock.hash !== expectedNextHash) {
      reasons.push(`nextBlock.hash is invalid (expected ${expectedNextHash}, got ${nextBlock.hash})`);
    }
  
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

function isValidTicTacToeTransition(prevState, nextState) {
    const reasons = [];

    if (!nextState.board || !Array.isArray(nextState.board) || nextState.board.length !== 9) {
        reasons.push('nextState must have a "board" property that is an array of 9 elements.');
        return { valid: false, reasons };
    }

    if (prevState.winner || prevState.isDraw) {
        reasons.push('Game is already over.');
        return { valid: false, reasons };
    }

    let changes = 0;
    let movedPlayer = null;
    for (let i = 0; i < 9; i++) {
        if (prevState.board[i] !== nextState.board[i]) {
            changes++;
            if (prevState.board[i] !== null) {
                reasons.push(`Board position ${i} was illegally changed.`);
            }
            movedPlayer = nextState.board[i];
        }
    }

    if (changes !== 1) {
        reasons.push(`Expected 1 change, but found ${changes}.`);
    }

    if (movedPlayer !== prevState.turn) {
        reasons.push(`It is ${prevState.turn}'s turn, but ${movedPlayer} moved.`);
    }

    return { valid: reasons.length === 0, reasons };
}

module.exports = {
  Blockchain,
  Block,
  getObjectFromBlock,
  isValidBlockTransition,
  isValidTicTacToeTransition,
};