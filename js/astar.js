/**
 * astar.js
 * High-performance A* Search algorithm implementation with a Binary Min-Heap Priority Queue.
 * Tracks search metrics, expansion trace, frontier/explored states, and computes final solution paths.
 */

// Environment compatibility helper (Node.js vs Browser)
const _StateClass = (typeof PuzzleState !== 'undefined') 
  ? PuzzleState 
  : (typeof require !== 'undefined' ? require('./puzzle.js').PuzzleState : null);

const _HeuristicsClass = (typeof Heuristics !== 'undefined') 
  ? Heuristics 
  : (typeof require !== 'undefined' ? require('./heuristics.js').Heuristics : null);

/**
 * Min-Heap Priority Queue for A* Search.
 * Compares by f(n) ascending; ties broken by h(n) ascending (closer to goal).
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  peek() {
    return this.heap[0] || null;
  }

  push(node) {
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.isEmpty()) return null;
    const min = this.heap[0];
    const end = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = end;
      this._sinkDown(0);
    }
    return min;
  }

  _bubbleUp(index) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIdx = Math.floor((index - 1) / 2);
      const parent = this.heap[parentIdx];
      if (this._compare(element, parent) < 0) {
        this.heap[index] = parent;
        this.heap[parentIdx] = element;
        index = parentIdx;
      } else {
        break;
      }
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      let leftChildIdx = 2 * index + 1;
      let rightChildIdx = 2 * index + 2;
      let swapIdx = null;

      if (leftChildIdx < length) {
        if (this._compare(this.heap[leftChildIdx], element) < 0) {
          swapIdx = leftChildIdx;
        }
      }

      if (rightChildIdx < length) {
        if (
          (swapIdx === null && this._compare(this.heap[rightChildIdx], element) < 0) ||
          (swapIdx !== null && this._compare(this.heap[rightChildIdx], this.heap[leftChildIdx]) < 0)
        ) {
          swapIdx = rightChildIdx;
        }
      }

      if (swapIdx === null) break;
      this.heap[index] = this.heap[swapIdx];
      this.heap[swapIdx] = element;
      index = swapIdx;
    }
  }

  _compare(a, b) {
    // Primary sort: f(n) = g(n) + h(n)
    if (a.f !== b.f) return a.f - b.f;
    // Tie breaker 1: h(n) (lower heuristic is preferred)
    if (a.h !== b.h) return a.h - b.h;
    // Tie breaker 2: Node creation order
    return a.id - b.id;
  }

  /**
   * Returns snapshot of top K items in the frontier for UI inspection.
   */
  getTop(k = 10) {
    return [...this.heap]
      .sort((a, b) => this._compare(a, b))
      .slice(0, k);
  }
}

/**
 * Node class representing a state in the search space.
 */
class SearchNode {
  constructor(state, parent = null, action = null, movedTile = null, g = 0, h = 0, id = 0) {
    this.state = state;
    this.parent = parent;
    this.action = action;       // 'UP', 'DOWN', 'LEFT', 'RIGHT' or 'START'
    this.movedTile = movedTile; // Tile number that moved into blank
    this.g = g;                 // Path cost (depth from root)
    this.h = h;                 // Heuristic estimate to goal
    this.f = g + h;             // Evaluation function
    this.depth = g;
    this.id = id;
  }
}

/**
 * A* Solver with comprehensive statistics and search visualization trace.
 */
class AStarSolver {
  /**
   * @param {Object} options
   * @param {string} options.heuristicName - 'manhattan' | 'misplaced' | 'linearConflict'
   * @param {number} options.maxExpansions - Safety cutoff to prevent UI freezing (default 100,000)
   * @param {number} options.maxTraceSteps - Max number of detailed search steps recorded for animation
   */
  constructor(options = {}) {
    this.heuristicName = options.heuristicName || 'manhattan';
    this.maxExpansions = options.maxExpansions || 100000;
    this.maxTraceSteps = options.maxTraceSteps || 500;
  }

  /**
   * Evaluates heuristic for a board state.
   */
  computeHeuristic(board, goalBoard) {
    switch (this.heuristicName) {
      case 'misplaced':
        return _HeuristicsClass.misplacedTiles(board, goalBoard);
      case 'linearConflict':
        return _HeuristicsClass.linearConflict(board, goalBoard);
      case 'manhattan':
      default:
        return _HeuristicsClass.manhattanDistance(board, goalBoard);
    }
  }

  /**
   * Solves the 8-puzzle problem using A* Search.
   * @param {number[]} initialBoard
   * @param {number[]} goalBoard
   * @returns {Object} Search result and comprehensive metrics
   */
  solve(initialBoard, goalBoard) {
    const startTime = performance.now();

    const initial = new _StateClass(initialBoard);
    const goal = new _StateClass(goalBoard);

    // Initial validation and solvability verification
    if (!initial.isSolvable(goal)) {
      return {
        found: false,
        reason: 'UNSOLVABLE',
        message: 'The initial state has mismatched inversion parity with the goal state and is mathematically unsolvable.',
        initialInversions: initial.getInversions(),
        goalInversions: goal.getInversions(),
        timeMs: performance.now() - startTime,
        nodesGenerated: 0,
        nodesExpanded: 0,
        maxDepth: 0,
        pathCost: 0,
        path: []
      };
    }

    let nodeIdCounter = 0;
    const frontier = new MinHeap();
    const openMap = new Map();   // stateStr -> g
    const closedSet = new Map(); // stateStr -> node

    // Initial root node
    const h0 = this.computeHeuristic(initial.board, goal.board);
    const rootNode = new SearchNode(initial, null, 'START', null, 0, h0, ++nodeIdCounter);

    frontier.push(rootNode);
    openMap.set(initial.toString(), 0);

    let nodesExpanded = 0;
    let nodesGenerated = 1;
    let maxDepth = 0;
    let goalNode = null;

    // Search trace for live or stepped search exploration visualization
    const searchSteps = [];

    while (!frontier.isEmpty()) {
      if (nodesExpanded >= this.maxExpansions) {
        return {
          found: false,
          reason: 'MAX_EXPANSIONS_EXCEEDED',
          message: `Reached expansion limit of ${this.maxExpansions} nodes without reaching goal.`,
          timeMs: performance.now() - startTime,
          nodesGenerated,
          nodesExpanded,
          maxDepth,
          pathCost: 0,
          path: []
        };
      }

      const current = frontier.pop();
      const currentKey = current.state.toString();
      openMap.delete(currentKey);

      // Check if already in closed set with equal or lower g
      if (closedSet.has(currentKey)) {
        continue;
      }

      closedSet.set(currentKey, current);
      nodesExpanded++;
      if (current.depth > maxDepth) {
        maxDepth = current.depth;
      }

      // Check Goal Test
      if (current.state.equals(goal)) {
        goalNode = current;

        // Record final goal expansion step if within trace limits
        if (searchSteps.length < this.maxTraceSteps) {
          searchSteps.push({
            step: nodesExpanded,
            currentNode: {
              board: [...current.state.board],
              g: current.g,
              h: current.h,
              f: current.f,
              action: current.action,
              depth: current.depth,
              parentId: current.parent ? current.parent.id : null
            },
            successors: [],
            nodesGenerated,
            nodesExpanded,
            frontierSize: frontier.size(),
            closedSize: closedSet.size,
            isGoal: true
          });
        }
        break;
      }

      // Generate valid successors
      const successors = current.state.getSuccessors();
      const recordedSuccessors = [];

      for (const succ of successors) {
        const succKey = succ.state.toString();
        const succG = current.g + 1;

        // Graph search: ignore if already explored in closed set
        if (closedSet.has(succKey)) {
          continue;
        }

        // If in frontier with better or equal g, skip
        if (openMap.has(succKey) && openMap.get(succKey) <= succG) {
          continue;
        }

        const succH = this.computeHeuristic(succ.state.board, goal.board);
        const succNode = new SearchNode(
          succ.state,
          current,
          succ.action,
          succ.movedTile,
          succG,
          succH,
          ++nodeIdCounter
        );

        frontier.push(succNode);
        openMap.set(succKey, succG);
        nodesGenerated++;

        if (recordedSuccessors.length < 4) {
          recordedSuccessors.push({
            board: [...succ.state.board],
            action: succ.action,
            movedTile: succ.movedTile,
            g: succG,
            h: succH,
            f: succG + succH
          });
        }
      }

      // Record step snapshot for real-time visualization if within trace limit
      if (searchSteps.length < this.maxTraceSteps) {
        searchSteps.push({
          step: nodesExpanded,
          currentNode: {
            id: current.id,
            board: [...current.state.board],
            g: current.g,
            h: current.h,
            f: current.f,
            action: current.action,
            movedTile: current.movedTile,
            depth: current.depth,
            parentId: current.parent ? current.parent.id : null
          },
          successors: recordedSuccessors,
          nodesGenerated,
          nodesExpanded,
          frontierSize: frontier.size(),
          closedSize: closedSet.size,
          frontierSample: frontier.getTop(5).map(n => ({
            id: n.id,
            board: [...n.state.board],
            g: n.g,
            h: n.h,
            f: n.f,
            action: n.action
          })),
          isGoal: false
        });
      }
    }

    const endTime = performance.now();
    const executionTimeMs = parseFloat((endTime - startTime).toFixed(2));

    if (!goalNode) {
      return {
        found: false,
        reason: 'NO_SOLUTION',
        message: 'Search space exhausted without finding a solution.',
        timeMs: executionTimeMs,
        nodesGenerated,
        nodesExpanded,
        maxDepth,
        pathCost: 0,
        path: []
      };
    }

    // Reconstruct solution path by backtracking from goal node
    const path = [];
    let curr = goalNode;
    while (curr) {
      path.unshift({
        board: [...curr.state.board],
        action: curr.action,
        movedTile: curr.movedTile,
        g: curr.g,
        h: curr.h,
        f: curr.f,
        depth: curr.depth,
        stepNumber: 0 // Will assign below
      });
      curr = curr.parent;
    }

    // Assign sequential step numbers 0, 1, 2, ...
    path.forEach((step, idx) => {
      step.stepNumber = idx;
    });

    // Approximate memory usage: each node ~ 128 bytes + map entries
    const approximateMemoryBytes = (nodesGenerated * 140) + (closedSet.size * 90);
    const approximateMemoryKB = parseFloat((approximateMemoryBytes / 1024).toFixed(2));

    return {
      found: true,
      heuristicUsed: this.heuristicName,
      movesCount: path.length - 1, // Number of moves to reach goal
      pathCost: goalNode.g,
      totalNodesGenerated: nodesGenerated,
      totalNodesExpanded: nodesExpanded,
      maxSearchDepth: maxDepth,
      executionTimeMs,
      memoryUsageKB: approximateMemoryKB,
      frontierRemaining: frontier.size(),
      closedSetSize: closedSet.size,
      path,
      searchSteps, // Trace for search process visualizer
      initialInversions: initial.getInversions(),
      goalInversions: goal.getInversions()
    };
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { AStarSolver, SearchNode, MinHeap };
}
