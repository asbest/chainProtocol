# chainProtocol
With this protocol multiple user clients can communicate serverless with each other using a decentral, simple blockchain. 

# implementation
- This protocol is implemented as a javascript API so that it can be easily included. All used APIs are open source.
- The protocol provides functions to generate a new blockchain,
- save a blockchain as compressed, serialized String,
- load a blockchain from String,
- generate a block containing a serialized object
- retrieve an object from a block

# Usage
```javascript
const {
    Blockchain,
    generateBlock,
    getObjectFromBlock
} = require('./index');

// Create a new blockchain
const myChain = new Blockchain();

// Bind generateBlock to myChain instance
const generateBlockForMyChain = generateBlock.bind(myChain);

// Add some blocks
generateBlockForMyChain({ message: 'Hello' });
generateBlockForMyChain({ message: 'World' });

console.log("Original chain:", myChain.chain);

// Save the blockchain
const savedChain = myChain.save();
console.log("Saved and compressed chain:", savedChain);

// Load the blockchain
const loadedChain = Blockchain.load(savedChain);
console.log("Loaded chain:", loadedChain.chain);

// Verify the loaded chain
console.log("Is loaded chain valid?", loadedChain.isChainValid());

// Retrieve data from a block
const block1 = loadedChain.chain[1];
const data1 = getObjectFromBlock(block1);
console.log("Data from block 1:", data1);
```

# Demo
To run the demo:
1. Ensure all dependencies are installed: `npm install`
2. Build the demo bundle: `npm run build-demo`
3. Open `demo.html` in your web browser.

# use cases
- multiplayer chat
- multiplayer games

# advantages
- no server needed
- no external service
- no manipulation possible
- maximum data prototection
