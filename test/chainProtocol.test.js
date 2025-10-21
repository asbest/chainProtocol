const {
    Blockchain,
    Block,
    getObjectFromBlock,
    isValidTicTacToeTransition
} = require('../index');

// Existing tests for Blockchain ...

describe('isValidTicTacToeTransition', () => {
    let initialState;

    beforeEach(() => {
        initialState = {
            board: Array(9).fill(null),
            turn: 'X',
            winner: null,
            isDraw: false
        };
    });

    it('should validate a legal first move', () => {
        const nextState = JSON.parse(JSON.stringify(initialState));
        nextState.board[0] = 'X';
        nextState.turn = 'O';
        const { valid, reasons } = isValidTicTacToeTransition(initialState, nextState);
        expect(valid).toBe(true);
        expect(reasons.length).toBe(0);
    });

    it('should invalidate a move on a taken cell', () => {
        initialState.board[0] = 'X';
        const nextState = JSON.parse(JSON.stringify(initialState));
        nextState.board[0] = 'O';
        const { valid, reasons } = isValidTicTacToeTransition(initialState, nextState);
        expect(valid).toBe(false);
        expect(reasons).toContain('Board position 0 was illegally changed.');
    });

    it('should invalidate a move when it is not the player\'s turn', () => {
        const nextState = JSON.parse(JSON.stringify(initialState));
        nextState.board[0] = 'O';
        const { valid, reasons } = isValidTicTacToeTransition(initialState, nextState);
        expect(valid).toBe(false);
        expect(reasons).toContain("It is X's turn, but O moved.");
    });

    it('should invalidate a move if the game is already won', () => {
        initialState.winner = 'X';
        const nextState = JSON.parse(JSON.stringify(initialState));
        nextState.board[0] = 'O';
        const { valid, reasons } = isValidTicTacToeTransition(initialState, nextState);
        expect(valid).toBe(false);
        expect(reasons).toContain('Game is already over.');
    });

    it('should invalidate a move if more than one cell is changed', () => {
        const nextState = JSON.parse(JSON.stringify(initialState));
        nextState.board[0] = 'X';
        nextState.board[1] = 'X';
        nextState.turn = 'O';
        const { valid, reasons } = isValidTicTacToeTransition(initialState, nextState);
        expect(valid).toBe(false);
        expect(reasons).toContain('Expected 1 change, but found 2.');
    });
});