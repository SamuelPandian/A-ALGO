/**
 * heuristics.js
 * Heuristic functions for A* Search on the 8-Puzzle.
 * Implements:
 * 1. Manhattan Distance (h2)
 * 2. Misplaced Tiles (h1)
 * 3. Linear Conflict + Manhattan (enhanced admissible heuristic)
 */

class Heuristics {
  /**
   * Precomputes goal tile coordinates for fast O(1) coordinate lookup.
   * @param {number[]} goalBoard
   * @returns {Map<number, {row: number, col: number}>}
   */
  static getGoalPositions(goalBoard) {
    const map = new Map();
    for (let i = 0; i < 9; i++) {
      const tile = goalBoard[i];
      map.set(tile, {
        row: Math.floor(i / 3),
        col: i % 3
      });
    }
    return map;
  }

  /**
   * Misplaced Tiles Heuristic (h1):
   * Counts the number of tiles that are currently not in their goal position.
   * Blank tile (0) is ignored.
   * 
   * Properties:
   * - Admissible: Each misplaced tile must move at least once.
   * - Consistent: A single move can correct at most one misplaced tile.
   * 
   * @param {number[]} currentBoard
   * @param {number[]} goalBoard
   * @returns {number}
   */
  static misplacedTiles(currentBoard, goalBoard) {
    let misplaced = 0;
    for (let i = 0; i < 9; i++) {
      const tile = currentBoard[i];
      if (tile !== 0 && tile !== goalBoard[i]) {
        misplaced++;
      }
    }
    return misplaced;
  }

  /**
   * Manhattan Distance Heuristic (h2):
   * Sum of the horizontal and vertical distances from current positions
   * to goal positions for all non-blank tiles.
   * 
   * Properties:
   * - Admissible: In a relaxed problem where tiles can slide over each other,
   *   this is the exact minimum number of moves.
   * - Consistent: A single tile slide changes its distance by exactly +1 or -1.
   * - Dominates Misplaced Tiles: h_manhattan(n) >= h_misplaced(n) for all states n.
   * 
   * @param {number[]} currentBoard
   * @param {Map<number, {row: number, col: number}>|number[]} goal
   * @returns {number}
   */
  static manhattanDistance(currentBoard, goal) {
    const goalMap = goal instanceof Map ? goal : this.getGoalPositions(goal);
    let distance = 0;

    for (let i = 0; i < 9; i++) {
      const tile = currentBoard[i];
      if (tile !== 0) {
        const curRow = Math.floor(i / 3);
        const curCol = i % 3;
        const target = goalMap.get(tile);
        if (target) {
          distance += Math.abs(curRow - target.row) + Math.abs(curCol - target.col);
        }
      }
    }

    return distance;
  }

  /**
   * Linear Conflict Heuristic (h3):
   * Manhattan Distance + 2 * (number of linear conflicts).
   * Two tiles Tj and Tk are in linear conflict if they are both in their goal row/column,
   * but their relative order is inverted, requiring at least one to move aside.
   * 
   * Properties: Admissible and consistent; expands fewer nodes than Manhattan.
   * 
   * @param {number[]} currentBoard
   * @param {number[]} goalBoard
   * @returns {number}
   */
  static linearConflict(currentBoard, goalBoard) {
    const goalMap = this.getGoalPositions(goalBoard);
    let h = this.manhattanDistance(currentBoard, goalMap);
    let conflicts = 0;

    // Check row conflicts
    for (let row = 0; row < 3; row++) {
      const rowTiles = [];
      for (let col = 0; col < 3; col++) {
        const tile = currentBoard[row * 3 + col];
        if (tile !== 0) {
          const target = goalMap.get(tile);
          if (target && target.row === row) {
            rowTiles.push({ tile, targetCol: target.col, curCol: col });
          }
        }
      }
      for (let i = 0; i < rowTiles.length; i++) {
        for (let j = i + 1; j < rowTiles.length; j++) {
          if (
            (rowTiles[i].curCol < rowTiles[j].curCol && rowTiles[i].targetCol > rowTiles[j].targetCol) ||
            (rowTiles[i].curCol > rowTiles[j].curCol && rowTiles[i].targetCol < rowTiles[j].targetCol)
          ) {
            conflicts++;
          }
        }
      }
    }

    // Check col conflicts
    for (let col = 0; col < 3; col++) {
      const colTiles = [];
      for (let row = 0; row < 3; row++) {
        const tile = currentBoard[row * 3 + col];
        if (tile !== 0) {
          const target = goalMap.get(tile);
          if (target && target.col === col) {
            colTiles.push({ tile, targetRow: target.row, curRow: row });
          }
        }
      }
      for (let i = 0; i < colTiles.length; i++) {
        for (let j = i + 1; j < colTiles.length; j++) {
          if (
            (colTiles[i].curRow < colTiles[j].curRow && colTiles[i].targetRow > colTiles[j].targetRow) ||
            (colTiles[i].curRow > colTiles[j].curRow && colTiles[i].targetRow < colTiles[j].targetRow)
          ) {
            conflicts++;
          }
        }
      }
    }

    return h + (2 * conflicts);
  }

  /**
   * Detailed breakdown for each tile's contribution to Manhattan and Misplaced values.
   * Useful for visualizer inspect tooltips.
   */
  static getTileBreakdown(currentBoard, goalBoard) {
    const goalMap = this.getGoalPositions(goalBoard);
    const breakdown = [];

    for (let i = 0; i < 9; i++) {
      const tile = currentBoard[i];
      if (tile === 0) continue;

      const curRow = Math.floor(i / 3);
      const curCol = i % 3;
      const target = goalMap.get(tile);

      const dRow = Math.abs(curRow - target.row);
      const dCol = Math.abs(curCol - target.col);
      const manhattan = dRow + dCol;
      const misplaced = (tile !== goalBoard[i]) ? 1 : 0;

      breakdown.push({
        tile,
        currentPos: { row: curRow, col: curCol },
        goalPos: target,
        manhattan,
        misplaced
      });
    }

    return breakdown;
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Heuristics };
}
