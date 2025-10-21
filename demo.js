const { Blockchain, isValidTicTacToeTransition } = require('./index');

const boardElement = document.getElementById('game-board');
const statusElement = document.getElementById('status');
const resetButton = document.getElementById('reset-button');

let blockchain = new Blockchain();
let currentPlayer = 'X';
let gameActive = true;

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
}

function renderBoard() {
    boardElement.innerHTML = '';
    const latestBlock = blockchain.getLatestBlock();
    const board = latestBlock.data.board;

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
    const index = event.target.dataset.index;
    const latestBlock = blockchain.getLatestBlock();
    const currentState = latestBlock.data;

    if (currentState.board[index] || !gameActive) {
        return;
    }

    const nextState = JSON.parse(JSON.stringify(currentState));
    nextState.board[index] = currentPlayer;
    nextState.turn = currentPlayer === 'X' ? 'O' : 'X';

    const { valid, reasons } = isValidTicTacToeTransition(currentState, nextState);

    if (valid) {
        const winnerInfo = checkWinner(nextState.board);
        if (winnerInfo) {
            nextState.winner = winnerInfo.winner;
            gameActive = false;
        } else if (nextState.board.every(cell => cell !== null)) {
            nextState.isDraw = true;
            gameActive = false;
        }

        blockchain.generateBlock(nextState);
        currentPlayer = nextState.turn;
        renderBoard();
        updateStatus();
    } else {
        alert('Invalid move: ' + reasons.join(', '));
    }
}

function updateStatus() {
    const latestBlock = blockchain.getLatestBlock();
    const { winner, isDraw, turn } = latestBlock.data;

    if (winner) {
        statusElement.textContent = `Player ${winner} wins!`;
        gameActive = false;
    } else if (isDraw) {
        statusElement.textContent = 'The game is a draw!';
        gameActive = false;
    } else {
        statusElement.textContent = `Player ${turn}'s turn`;
        gameActive = true;
    }
}

function checkWinner(board) {
    const winningCombos = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // columns
        [0, 4, 8], [2, 4, 6]             // diagonals
    ];

    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], combo };
        }
    }

    return null;
}

resetButton.addEventListener('click', initializeGame);

initializeGame();