const { Blockchain, isValidTicTacToeTransition, TorSignalingClient } = require('./index-browser');
const SimplePeer = require('simple-peer');
const pako = require('pako');

// DOM Elements
const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('status');
const resetButton = document.getElementById('reset-button');
const hostButton = document.getElementById('host-button');
const connectButton = document.getElementById('connect-button');
const onionAddressInput = document.getElementById('onion-address');
const gameIdInput = document.getElementById('game-id');
const hostInfo = document.getElementById('host-info');

// Game State
let blockchain = new Blockchain();
let p2p;
let player; // 'X' for host, 'O' for guest
let gameActive = false;
let signalingClient;

// --- Game Logic ---
function initializeGame() {
    blockchain = new Blockchain();
    const initialState = {
        board: Array(9).fill(null),
        turn: 'X',
        winner: null,
        isDraw: false
    };
    blockchain.generateBlock(initialState);
    renderBoard();
    updateStatus();
    gameActive = p2p && p2p.connected;
}

function renderBoard() {
    boardElement.innerHTML = '';
    const board = blockchain.getLatestBlock().data.board;
    for (let i = 0; i < board.length; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        cell.dataset.index = i;
        cell.textContent = board[i];
        cell.addEventListener('click', handleCellClick);
        boardElement.appendChild(cell);
    }
}

function handleCellClick(event) {
    const index = parseInt(event.target.dataset.index, 10);
    const currentState = blockchain.getLatestBlock().data;

    if (currentState.board[index] || !gameActive || currentState.turn !== player) {
        return;
    }

    const nextState = JSON.parse(JSON.stringify(currentState));
    nextState.board[index] = player;
    nextState.turn = player === 'X' ? 'O' : 'X';

    const winnerInfo = checkWinner(nextState.board);
    if (winnerInfo) {
        nextState.winner = winnerInfo.winner;
    } else if (nextState.board.every(cell => cell !== null)) {
        nextState.isDraw = true;
    }

    if (isValidTicTacToeTransition(currentState, nextState).valid) {
        blockchain.generateBlock(nextState);
        renderBoard();
        updateStatus();
        const compressedState = pako.deflate(JSON.stringify(nextState));
        p2p.send(compressedState);
    } else {
        alert('Invalid move!');
    }
}

function updateStatus() {
    const { winner, isDraw, turn } = blockchain.getLatestBlock().data;

    if (winner) {
        statusElement.textContent = `Player ${winner} wins!`;
        gameActive = false;
    } else if (isDraw) {
        statusElement.textContent = 'The game is a draw!';
        gameActive = false;
    } else if (gameActive) {
        statusElement.textContent = (turn === player) ? "Your turn" : `Waiting for Player ${turn}...`;
    } else {
        statusElement.textContent = 'Waiting for connection...';
    }
}

function checkWinner(board) {
    const winningCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a] };
        }
    }
    return null;
}

// --- P2P Connection ---
function setupP2P(isInitiator, gameId) {
    p2p = new SimplePeer({ initiator: isInitiator, trickle: false });

    p2p.on('error', err => console.error('P2P Error:', err));
    p2p.on('close', () => {
        gameActive = false;
        statusElement.textContent = 'Connection closed.';
    });

    p2p.on('connect', () => {
        gameActive = true;
        statusElement.textContent = 'Connected! You are Player ' + player + '.';
        updateStatus();
    });

    p2p.on('data', compressedData => {
        try {
            const data = pako.inflate(compressedData, { to: 'string' });
            const nextState = JSON.parse(data);
            if (isValidTicTacToeTransition(blockchain.getLatestBlock().data, nextState).valid) {
                blockchain.generateBlock(nextState);
                renderBoard();
                updateStatus();
            }
        } catch (err) {
            console.error('Error processing received data:', err);
        }
    });

    p2p.on('signal', data => {
        const signalString = JSON.stringify(data);
        if (isInitiator) {
            signalingClient.sendOffer(gameId, signalString)
                .then(() => {
                    statusElement.textContent = 'Offer sent! Polling for an answer...';
                    pollForAnswer(gameId);
                })
                .catch(err => {
                    console.error('Failed to send offer:', err);
                    statusElement.textContent = 'Error: Could not send offer.';
                });
        } else {
            signalingClient.sendAnswer(gameId, signalString)
                .catch(err => {
                    console.error('Failed to send answer:', err);
                    statusElement.textContent = 'Error: Could not send answer.';
                });
        }
    });
}

function pollForAnswer(gameId) {
    const interval = setInterval(async () => {
        try {
            const answer = await signalingClient.getAnswer(gameId);
            if (answer) {
                p2p.signal(JSON.parse(answer));
                clearInterval(interval);
            }
        } catch (err) {
            console.error('Error polling for answer:', err);
            clearInterval(interval);
        }
    }, 5000);
}

// --- Event Listeners ---
hostButton.addEventListener('click', () => {
    const onionAddress = onionAddressInput.value;
    if (!onionAddress) {
        alert('Please provide the signaling server onion address.');
        return;
    }

    player = 'X';
    signalingClient = new TorSignalingClient(onionAddress);
    const gameId = 'game-' + Math.random().toString(36).substr(2, 9);
    hostInfo.textContent = `Game hosted! Share this Game ID with the other player: ${gameId}`;

    statusElement.textContent = 'Creating offer...';
    setupP2P(true, gameId);
    initializeGame();
});

connectButton.addEventListener('click', async () => {
    const onionAddress = onionAddressInput.value;
    const gameId = gameIdInput.value;
    if (!onionAddress || !gameId) {
        alert('Please provide the signaling server onion address and the Game ID.');
        return;
    }

    player = 'O';
    signalingClient = new TorSignalingClient(onionAddress);
    statusElement.textContent = 'Fetching offer...';

    try {
        const offer = await signalingClient.getOffer(gameId);
        if (offer) {
            statusElement.textContent = 'Offer received! Creating answer...';
            setupP2P(false, gameId);
            p2p.signal(JSON.parse(offer));
            initializeGame();
        } else {
            statusElement.textContent = 'Error: Could not find an offer for that Game ID.';
        }
    } catch (err) {
        console.error('Failed to get offer:', err);
        statusElement.textContent = 'Error: Could not get offer.';
    }
});

resetButton.addEventListener('click', initializeGame);

// Initial Load
initializeGame();
statusElement.textContent = 'Enter the signaling server address to start.';
