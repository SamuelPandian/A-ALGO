/**
 * puzzle.js
 * Core state representation, validation, solvability verification,
 * neighbor generation, and random scramble generator for the 8-Puzzle.
 */

class PuzzleState {
  /**
   * @param {number[]} board - 9-element array representing the 3x3 board (0 is the blank tile)
   */
  constructor(board) {
    this.board = [...board];
    this.blankIndex = this.board.indexOf(0);
  }

  /**
   * Returns a canonical string representation for hashing and closed set tracking.
   */
  toString() {
    return this.board.join(',');
  }

  /**
   * Checks if this state equals another board or PuzzleState
   */
  equals(other) {
    const otherBoard = other instanceof PuzzleState ? other.board : other;
    for (let i = 0; i < 9; i++) {
      if (this.board[i] !== otherBoard[i]) return false;
    }
    return true;
  }

  /**
   * Calculates the number of inversions in the board (ignoring blank tile 0).
   * An inversion is a pair of tiles (a, b) such that a appears before b, but a > b.
   */
  getInversions() {
    let inversions = 0;
    const tiles = this.board.filter(tile => tile !== 0);
    for (let i = 0; i < tiles.length; i++) {
      for (let j = i + 1; j < tiles.length; j++) {
        if (tiles[i] > tiles[j]) {
          inversions++;
        }
      }
    }
    return inversions;
  }

  /**
   * Checks if this state can reach the goal state.
   * In the 8-puzzle (odd grid width = 3), a state is reachable from another if and only if
   * both states have the same inversion parity (both even or both odd).
   * @param {PuzzleState|number[]} goal
   * @returns {boolean}
   */
  isSolvable(goal) {
    const goalState = goal instanceof PuzzleState ? goal : new PuzzleState(goal);
    return (this.getInversions() % 2) === (goalState.getInversions() % 2);
  }

  /**
   * Generates all valid successor states from moving the blank tile.
   * Actions: UP, DOWN, LEFT, RIGHT.
   * @returns {Array<{ action: string, state: PuzzleState, movedTile: number }>}
   */
  getSuccessors() {
    const successors = [];
    const blank = this.blankIndex;
    const row = Math.floor(blank / 3);
    const col = blank % 3;

    // Movement vectors for the blank tile: [dRow, dCol, actionName]
    const moves = [
      { dRow: -1, dCol: 0, action: 'UP' },
      { dRow: 1, dCol: 0, action: 'DOWN' },
      { dRow: 0, dCol: -1, action: 'LEFT' },
      { dRow: 0, dCol: 1, action: 'RIGHT' }
    ];

    for (const { dRow, dCol, action } of moves) {
      const newRow = row + dRow;
      const newCol = col + dCol;

      if (newRow >= 0 && newRow < 3 && newCol >= 0 && newCol < 3) {
        const targetIndex = newRow * 3 + newCol;
        const newBoard = [...this.board];
        const movedTile = newBoard[targetIndex];

        // Swap blank tile with adjacent target tile
        newBoard[blank] = movedTile;
        newBoard[targetIndex] = 0;

        successors.push({
          action,
          state: new PuzzleState(newBoard),
          movedTile
        });
      }
    }

    return successors;
  }

  /**
   * Formats the board as a 3x3 array for display purposes.
   */
  toGrid() {
    return [
      this.board.slice(0, 3),
      this.board.slice(3, 6),
      this.board.slice(6, 9)
    ];
  }
}

/**
 * Utility functions for 8-Puzzle manipulation and validation.
 */
const PuzzleUtils = {
  // Standard default goal state: 1 2 3 / 8 _ 4 / 7 6 5 (as in assignment) or 1 2 3 / 4 5 6 / 7 8 _
  DEFAULT_GOAL_ASSIGNMENT: [1, 2, 3, 8, 0, 4, 7, 6, 5],
  DEFAULT_GOAL_STANDARD: [1, 2, 3, 4, 5, 6, 7, 8, 0],

  /**
   * Validates if an array is a valid 8-puzzle board containing digits 0 through 8 once each.
   */
  isValidBoard(board) {
    if (!Array.isArray(board) || board.length !== 9) return false;
    const seen = new Set();
    for (const val of board) {
      const num = Number(val);
      if (isNaN(num) || num < 0 || num > 8 || seen.has(num)) {
        return false;
      }
      seen.add(num);
    }
    return seen.size === 9;
  },

  /**
   * Parses string or space/comma-separated input into a 9-element number array.
   * Accepts '_' or '0' as blank tile.
   */
  parseBoardInput(inputStr) {
    if (!inputStr) return null;
    const sanitized = inputStr.trim().replace(/_/g, '0');
    const tokens = sanitized.split(/[\s,]+/).filter(Boolean);
    if (tokens.length !== 9) return null;
    const board = tokens.map(t => parseInt(t, 10));
    return this.isValidBoard(board) ? board : null;
  },

  /**
   * Generates a random solvable puzzle by performing random walks from the goal state.
   * This guarantees that a solution of at most `steps` moves exists.
   * @param {number[]} goalBoard
   * @param {number} steps - Number of scramble moves
   * @returns {number[]}
   */
  generateRandomSolvable(goalBoard = this.DEFAULT_GOAL_ASSIGNMENT, steps = 18) {
    let current = new PuzzleState(goalBoard);
    let previousBlank = -1;

    for (let i = 0; i < steps; i++) {
      const successors = current.getSuccessors();
      // Avoid immediately undoing the move if possible
      const validMoves = successors.filter(s => s.state.blankIndex !== previousBlank);
      const chosen = (validMoves.length > 0 ? validMoves : successors)[
        Math.floor(Math.random() * (validMoves.length > 0 ? validMoves.length : successors.length))
      ];
      previousBlank = current.blankIndex;
      current = chosen.state;
    }

    // Ensure it's not accidentally identical to the goal
    if (current.equals(goalBoard)) {
      return this.generateRandomSolvable(goalBoard, steps + 2);
    }

    return current.board;
  }
};

// Export for module/browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PuzzleState, PuzzleUtils };
}
