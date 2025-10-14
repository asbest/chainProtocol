const {
    Blockchain,
    Block,
    generateBlock,
    getObjectFromBlock
} = require('./index');

const pako = require('pako');

const blockchainA = new Blockchain();
const blockchainB = new Blockchain();

const generateBlockForChainA = generateBlock.bind(blockchainA);
const generateBlockForChainB = generateBlock.bind(blockchainB);

const chatWindowA = document.getElementById('chat-window-a');
const messageInputA = document.getElementById('message-input-a');
const sendButtonA = document.getElementById('send-message-a');
const saveChainButtonA = document.getElementById('save-chain-a');
const showDecompressedA = document.getElementById('show-decompressed-a');
const chainDataA = document.getElementById('chain-data-a');
const decompressedDataA = document.getElementById('decompressed-data-a');
const chainValidityA = document.getElementById('chain-validity-a');
const loadChainInputA = document.getElementById('load-chain-input-a');
const loadChainButtonA = document.getElementById('load-chain-a');

const chatWindowB = document.getElementById('chat-window-b');
const messageInputB = document.getElementById('message-input-b');
const sendButtonB = document.getElementById('send-message-b');
const saveChainButtonB = document.getElementById('save-chain-b');
const showDecompressedB = document.getElementById('show-decompressed-b');
const chainDataB = document.getElementById('chain-data-b');
const decompressedDataB = document.getElementById('decompressed-data-b');
const chainValidityB = document.getElementById('chain-validity-b');
const loadChainInputB = document.getElementById('load-chain-input-b');
const loadChainButtonB = document.getElementById('load-chain-b');

function updateChatWindow(chatWindow, blockchainInstance) {
    chatWindow.innerHTML = '';
    blockchainInstance.chain.forEach(block => {
        if (block.index === 0) return; // Skip genesis block for chat display
        const messageElement = document.createElement('div');
        messageElement.className = 'message';
        messageElement.innerHTML = `
            <p><b>${block.data.sender}:</b> ${block.data.message}</p>
        `;
        chatWindow.appendChild(messageElement);
    });
    chatWindow.scrollTop = chatWindow.scrollHeight; // Scroll to bottom
}

function updateChainStatus(blockchainInstance, chainValidityElement) {
    const isValid = blockchainInstance.isChainValid();
    chainValidityElement.textContent = `Chain Valid: ${isValid}`;
    chainValidityElement.className = isValid ? 'chain-validity' : 'chain-validity invalid';
}

function updateAllDisplays() {
    updateChatWindow(chatWindowA, blockchainA);
    updateChainStatus(blockchainA, chainValidityA);
    updateChatWindow(chatWindowB, blockchainB);
    updateChainStatus(blockchainB, chainValidityB);
}

sendButtonA.addEventListener('click', () => {
    const message = messageInputA.value;
    if (message) {
        generateBlockForChainA({ sender: 'Client A', message: message });
        messageInputA.value = '';
        updateAllDisplays();
    }
});

sendButtonB.addEventListener('click', () => {
    const message = messageInputB.value;
    if (message) {
        generateBlockForChainB({ sender: 'Client B', message: message });
        messageInputB.value = '';
        updateAllDisplays();
    }
});

saveChainButtonA.addEventListener('click', () => {
    chainDataA.value = blockchainA.save();
});

saveChainButtonB.addEventListener('click', () => {
    chainDataB.value = blockchainB.save();
});

showDecompressedA.addEventListener('click', () => {
    const compressedString = chainDataA.value;
    if (compressedString) {
        try {
            const decompressed = pako.inflate(compressedString, { to: 'string' });
            decompressedDataA.value = JSON.stringify(JSON.parse(decompressed), null, 2);
        } catch (e) {
            decompressedDataA.value = 'Error decompressing: ' + e.message;
        }
    }
});

showDecompressedB.addEventListener('click', () => {
    const compressedString = chainDataB.value;
    if (compressedString) {
        try {
            const decompressed = pako.inflate(compressedString, { to: 'string' });
            decompressedDataB.value = JSON.stringify(JSON.parse(decompressed), null, 2);
        } catch (e) {
            decompressedDataB.value = 'Error decompressing: ' + e.message;
        }
    }
});

loadChainButtonA.addEventListener('click', () => {
    const compressedString = loadChainInputA.value;
    if (compressedString) {
        try {
            const loaded = Blockchain.load(compressedString);
            blockchainA.chain = loaded.chain;
            updateAllDisplays();
            alert('Client A: Blockchain loaded successfully!');
        } catch (e) {
            alert('Client A: Error loading blockchain: ' + e.message);
        }
    }
});

loadChainButtonB.addEventListener('click', () => {
    const compressedString = loadChainInputB.value;
    if (compressedString) {
        try {
            const loaded = Blockchain.load(compressedString);
            blockchainB.chain = loaded.chain;
            updateAllDisplays();
            alert('Client B: Blockchain loaded successfully!');
        } catch (e) {
            alert('Client B: Error loading blockchain: ' + e.message);
        }
    }
});

// Initial display
updateAllDisplays();
