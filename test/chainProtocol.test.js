const {
    Blockchain,
    Block,
    generateBlock,
    getObjectFromBlock
} = require('../index');

describe('Blockchain', () => {
    let blockchain;

    beforeEach(() => {
        blockchain = new Blockchain();
    });

    it('should create a new blockchain with a genesis block', () => {
        expect(blockchain.chain.length).toBe(1);
        const genesisBlock = blockchain.chain[0];
        expect(genesisBlock.data).toBe('Genesis Block');
        expect(genesisBlock.previousHash).toBe('0');
    });

    it('should add a new block to the blockchain', () => {
        const data = { message: 'Hello, world!' };
        const lastBlock = blockchain.getLatestBlock();
        const newBlock = new Block(lastBlock.index + 1, Date.now(), data, lastBlock.hash);
        blockchain.addBlock(newBlock);
        expect(blockchain.chain.length).toBe(2);
        expect(blockchain.getLatestBlock().data).toEqual(data);
    });

    it('should validate a valid blockchain', () => {
        const data = { message: 'Hello, world!' };
        const lastBlock = blockchain.getLatestBlock();
        const newBlock = new Block(lastBlock.index + 1, Date.now(), data, lastBlock.hash);
        blockchain.addBlock(newBlock);
        expect(blockchain.isChainValid()).toBe(true);
    });

    it('should invalidate a blockchain with a tampered block', () => {
        const data = { message: 'Hello, world!' };
        const lastBlock = blockchain.getLatestBlock();
        const newBlock = new Block(lastBlock.index + 1, Date.now(), data, lastBlock.hash);
        blockchain.addBlock(newBlock);
        blockchain.chain[1].data = { message: 'Tampered data' };
        expect(blockchain.isChainValid()).toBe(false);
    });

    it('should save and load a blockchain', () => {
        const data = { message: 'Hello, world!' };
        const lastBlock = blockchain.getLatestBlock();
        const newBlock = new Block(lastBlock.index + 1, Date.now(), data, lastBlock.hash);
        blockchain.addBlock(newBlock);

        const savedChain = blockchain.save();
        const loadedChain = Blockchain.load(savedChain);

        expect(loadedChain.chain.length).toBe(2);
        expect(loadedChain.isChainValid()).toBe(true);
        expect(loadedChain.getLatestBlock().data).toEqual(data);
    });

    it('should generate a block and add it to the chain', () => {
        const data = { message: 'Hello, world!' };
        const generateBlockForChain = generateBlock.bind(blockchain);
        generateBlockForChain(data);
        expect(blockchain.chain.length).toBe(2);
        expect(blockchain.getLatestBlock().data).toEqual(data);
    });

    it('should retrieve an object from a block', () => {
        const data = { message: 'Hello, world!' };
        const block = new Block(1, Date.now(), data);
        const retrievedData = getObjectFromBlock(block);
        expect(retrievedData).toEqual(data);
    });
});
