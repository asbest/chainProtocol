// PeerJS wird über CDN geladen (siehe demo.html)
// const Peer = require('peerjs'); // Nicht mehr nötig

// DOM Elements
const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('status');
const resetButton = document.getElementById('reset-button');
const hostButton = document.getElementById('host-button');
const joinButton = document.getElementById('join-button');
const connectButton = document.getElementById('connect-button');
const backButton = document.getElementById('back-button');
const roomInput = document.getElementById('room-input');
const roomCodeElement = document.getElementById('room-code');
const menuDiv = document.getElementById('menu');
const hostSection = document.getElementById('host-section');
const joinSection = document.getElementById('join-section');

// Game State
let peer;
let connection;
let player; // 'X' for host, 'O' for guest
let gameActive = false;
let board = Array(9).fill(null);
let currentTurn = 'X';
let winner = null;

// --- Game Logic ---
function initializeGame() {
    board = Array(9).fill(null);
    currentTurn = 'X';
    winner = null;
    renderBoard();
    updateStatus();
}

function renderBoard() {
    boardElement.innerHTML = '';
    for (let i = 0; i < 9; i++) {
        const cell = document.createElement('div');
        cell.classList.add('cell');
        if (!gameActive || winner || board[i]) {
            cell.classList.add('disabled');
        }
        cell.dataset.index = i;
        
        if (board[i]) {
            const span = document.createElement('span');
            span.classList.add(board[i]);
            span.textContent = board[i];
            cell.appendChild(span);
        }
        
        cell.addEventListener('click', handleCellClick);
        boardElement.appendChild(cell);
    }
}

function handleCellClick(event) {
    const index = parseInt(event.target.dataset.index, 10);

    if (!gameActive || winner || board[index] || currentTurn !== player) {
        return;
    }

    makeMove(index);
    
    if (connection && connection.open) {
        connection.send({ type: 'move', index: index });
    }
}

function makeMove(index) {
    board[index] = currentTurn;
    currentTurn = currentTurn === 'X' ? 'O' : 'X';
    
    winner = checkWinner();
    
    renderBoard();
    updateStatus();
}

function updateStatus() {
    if (winner) {
        if (winner === 'draw') {
            statusElement.textContent = '🤝 Unentschieden!';
        } else {
            statusElement.textContent = winner === player 
                ? `🎉 Du hast gewonnen! (${player})` 
                : `😞 ${winner} hat gewonnen!`;
        }
        gameActive = false;
        resetButton.classList.remove('hidden');
    } else if (gameActive) {
        statusElement.textContent = currentTurn === player 
            ? `🎯 Du bist dran (${player})` 
            : `⏳ Warte auf ${currentTurn}...`;
    } else if (player) {
        statusElement.textContent = '⏳ Verbindung wird hergestellt...';
    } else {
        statusElement.textContent = '👆 Wähle eine Option zum Starten';
    }
}

function checkWinner() {
    const winningCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    
    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }
    
    if (board.every(cell => cell !== null)) {
        return 'draw';
    }
    
    return null;
}

// --- P2P Connection ---
function setupConnection(conn) {
    connection = conn;
    
    connection.on('open', () => {
        gameActive = true;
        statusElement.textContent = `✅ Verbunden! Du spielst ${player}`;
        updateStatus();
    });
    
    connection.on('data', (data) => {
        if (data.type === 'move') {
            makeMove(data.index);
        } else if (data.type === 'reset') {
            initializeGame();
        }
    });
    
    connection.on('close', () => {
        gameActive = false;
        statusElement.textContent = '❌ Verbindung unterbrochen';
    });
    
    connection.on('error', (err) => {
        console.error('Connection error:', err);
    });
}

// --- Event Listeners ---
hostButton.addEventListener('click', () => {
    player = 'X';
    statusElement.textContent = '🔄 Verbinde mit Server...';
    hostButton.disabled = true;
    joinButton.disabled = true;
    
    // Erstelle PeerJS-Instanz (nutzt kostenlosen Cloud-Server)
    peer = new Peer();
    
    peer.on('open', (id) => {
        console.log('Peer ID:', id);
        roomCodeElement.textContent = id;
        menuDiv.classList.add('hidden');
        hostSection.classList.remove('hidden');
        statusElement.textContent = '⏳ Warte auf Mitspieler...';
        initializeGame();
    });
    
    peer.on('connection', (conn) => {
        console.log('Spieler verbindet sich!');
        setupConnection(conn);
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        statusElement.textContent = '❌ Fehler: ' + err.type;
        hostButton.disabled = false;
        joinButton.disabled = false;
    });
});

joinButton.addEventListener('click', () => {
    menuDiv.classList.add('hidden');
    joinSection.classList.remove('hidden');
    statusElement.textContent = 'Gib die Raum-ID ein...';
});

connectButton.addEventListener('click', () => {
    const roomId = roomInput.value.trim();
    if (!roomId) {
        alert('Bitte gib eine Raum-ID ein!');
        return;
    }
    
    player = 'O';
    statusElement.textContent = '🔄 Verbinde mit Server...';
    connectButton.disabled = true;
    
    // Erstelle PeerJS-Instanz
    peer = new Peer();
    
    peer.on('open', () => {
        console.log('Verbinde zu Raum:', roomId);
        statusElement.textContent = '🔗 Verbinde mit Spieler...';
        const conn = peer.connect(roomId);
        setupConnection(conn);
        initializeGame();
    });
    
    peer.on('error', (err) => {
        console.error('Peer error:', err);
        statusElement.textContent = '❌ Verbindung fehlgeschlagen: ' + err.type;
        connectButton.disabled = false;
    });
});

backButton.addEventListener('click', () => {
    joinSection.classList.add('hidden');
    menuDiv.classList.remove('hidden');
    statusElement.textContent = 'Wähle eine Option...';
    roomInput.value = '';
});

resetButton.addEventListener('click', () => {
    initializeGame();
    if (connection && connection.open) {
        connection.send({ type: 'reset' });
    }
});

// Initial Load
renderBoard();
statusElement.textContent = '👆 Wähle eine Option zum Starten';
