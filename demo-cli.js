const P2PNode = require('./lib/webrtc-node');
const { isValidTicTacToeTransition } = require('./index');
const readline = require('readline');
const net = require('net');
const EventEmitter = require('events');

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

const args = process.argv.slice(2);
const command = args[0];

if (!command || (command !== 'host' && command !== 'join')) {
    console.log('Usage: node demo-cli.js <host|join> [port/address]');
    process.exit(1);
}

// === Mock Peer Implementation for Testing without WebRTC binary ===
class MockPeer extends EventEmitter {
    constructor(opts) {
        super();
        this.initiator = opts.initiator;
        this.connected = false;
        this.socket = null;
        this.server = null;

        if (this.initiator) {
            process.nextTick(() => this.signal({}));
        }
    }

    signal(data) {
        if (this.connected) return;

        // If we are initiator, we create a TCP server and send the port
        if (this.initiator && !this.server) {
            this.server = net.createServer((socket) => {
                this.socket = socket;
                this.setupSocket();
            });
            this.server.listen(0, () => {
                const port = this.server.address().port;
                // Emit signal (simulating Offer) with our port
                this.emit('signal', { type: 'offer', port });
            });
        }
        // If we are receiver, we wait for the port (Offer) and connect
        else if (!this.initiator && data.port) {
            this.socket = net.connect(data.port, 'localhost', () => {
                this.setupSocket();
                // Emit signal (simulating Answer) to complete handshake
                this.emit('signal', { type: 'answer' });
            });
        }
        // Initiator receives Answer, handshake complete
        else if (this.initiator && data.type === 'answer') {
            // Already connected via server callback, just acknowledge
        }
    }

    // MockPeer must emit signal immediately if initiator, but SimplePeer does it internally.
    // We need to trigger the start of the process.
    // SimplePeer does it on nextTick or similar.
    // We should implement a constructor start.

    setupSocket() {
        this.connected = true;
        this.emit('connect');

        this.socket.on('data', (data) => {
            this.emit('data', data);
        });

        this.socket.on('close', () => {
            this.emit('close');
        });

        this.socket.on('error', (err) => {
            this.emit('error', err);
        });
    }

    send(data) {
        if (this.socket) {
            this.socket.write(data);
        }
    }

    destroy() {
        if (this.socket) this.socket.destroy();
        if (this.server) this.server.close();
    }
}
// ================================================================

// Detect if we need to use MockPeer
let useMock = false;
try {
    require('wrtc');
} catch (e) {
    console.log('WebRTC not available, using MockPeer over TCP for demo.');
    useMock = true;
}

const opts = {};
if (useMock) {
    opts.createPeer = (options) => new MockPeer(options);
}

let p2pNode = new P2PNode(null, opts);
let connectedPeer = null;
let myTurn = false;
let mySymbol = '';

// Game State
let currentState = {
    board: Array(9).fill(null),
    turn: 'X',
    winner: null,
    isDraw: false
};

function renderBoard(state) {
    const b = state.board.map(c => c || ' ');
    console.log('\n');
    console.log(` ${b[0]} | ${b[1]} | ${b[2]} `);
    console.log('---+---+---');
    console.log(` ${b[3]} | ${b[4]} | ${b[5]} `);
    console.log('---+---+---');
    console.log(` ${b[6]} | ${b[7]} | ${b[8]} `);
    console.log('\n');

    if (state.winner) {
        console.log(`Winner: ${state.winner}!`);
        process.exit(0);
    } else if (state.isDraw) {
        console.log('Draw!');
        process.exit(0);
    } else {
        console.log(`Turn: ${state.turn}`);
        if (state.turn === mySymbol) {
            console.log('Your turn! Enter position (0-8):');
            promptMove();
        } else {
            console.log('Waiting for opponent...');
        }
    }
}

function promptMove() {
    // If input is closed or not available, don't try to read
    if (rl.input.readableEnded || rl.closed) {
        return;
    }

    try {
        rl.question('> ', (answer) => {
            const index = parseInt(answer);
            if (isNaN(index) || index < 0 || index > 8) {
                console.log('Invalid input. Enter 0-8.');
                promptMove();
                return;
            }

            if (currentState.board[index] !== null) {
                console.log('Cell occupied.');
                promptMove();
                return;
            }

            makeMove(index);
        });
    } catch (e) {
        console.log('Readline error (non-interactive mode?):', e.message);
    }
}

function makeMove(index) {
    const nextState = JSON.parse(JSON.stringify(currentState));
    nextState.board[index] = mySymbol;
    nextState.turn = mySymbol === 'X' ? 'O' : 'X';

    // Check winner (simple logic here, or use imported logic if we trust it completely, but local check is good for UI)
    const { valid, reasons } = isValidTicTacToeTransition(currentState, nextState);
    if (!valid) {
        console.log('Invalid move:', reasons.join(', '));
        promptMove();
        return;
    }

    // Check win condition
    const winningCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];

    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        if (nextState.board[a] && nextState.board[a] === nextState.board[b] && nextState.board[a] === nextState.board[c]) {
            nextState.winner = nextState.board[a];
        }
    }

    if (!nextState.winner && nextState.board.every(c => c !== null)) {
        nextState.isDraw = true;
    }

    currentState = nextState;
    renderBoard(currentState);

    // Broadcast move
    p2pNode.broadcastBlock(currentState);
}

function handleIncomingBlock(blockData) {
    // console.log('Received move:', blockData);
    currentState = blockData;
    renderBoard(currentState);
}

// Override handleMessage to hook into game logic
const originalHandleMessage = p2pNode.handleMessage.bind(p2pNode);
p2pNode.handleMessage = (message, peer) => {
    if (message.type === 'NEW_BLOCK') {
        handleIncomingBlock(message.data);
    } else {
        originalHandleMessage(message, peer);
    }
};

if (command === 'host') {
    const port = args[1] || 3000;
    console.log(`Hosting on port ${port}...`);
    mySymbol = 'X';

    // Initialize blockchain with empty state
    p2pNode.blockchain.generateBlock(currentState);

    p2pNode.host(port, (peer) => {
        console.log('Player connected!');
        connectedPeer = peer;
        renderBoard(currentState);
    });
} else if (command === 'join') {
    const address = args[1] || 'http://localhost:3000';
    console.log(`Joining ${address}...`);
    mySymbol = 'O';

    p2pNode.join(address, null).then((peer) => {
        // console.log('Joined game!');
    });

    const checkConnect = setInterval(() => {
        if (p2pNode.peers.length > 0) {
            console.log('Connected to host!');
            clearInterval(checkConnect);
            connectedPeer = p2pNode.peers[0];

            // Wait for sync to happen
             setTimeout(() => {
                const latest = p2pNode.blockchain.getLatestBlock();
                if (latest.index > 0) {
                     currentState = latest.data;
                }
                renderBoard(currentState);
             }, 1000);
        }
    }, 500);
}
