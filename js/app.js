/**
 * app.js
 * Main application coordinator for the Interactive 8-Puzzle Solver.
 * Connects UI inputs, presets, heuristics, manual tile manipulation,
 * solver invocation, and visualizer lifecycle.
 */

// Presets data
const PRESETS = {
  assignment: {
    name: 'Assignment Case Study Example (5 Moves)',
    initial: [2, 8, 3, 1, 6, 4, 7, 0, 5],
    goal: [1, 2, 3, 8, 0, 4, 7, 6, 5]
  },
  easy: {
    name: 'Easy Standard (4 Moves)',
    initial: [1, 2, 3, 4, 0, 6, 7, 5, 8],
    goal: [1, 2, 3, 4, 5, 6, 7, 8, 0]
  },
  medium: {
    name: 'Medium Standard (10 Moves)',
    initial: [1, 2, 3, 0, 4, 6, 7, 5, 8],
    goal: [1, 2, 3, 4, 5, 6, 7, 8, 0]
  },
  hard: {
    name: 'Challenging (18 Moves)',
    initial: [4, 1, 3, 7, 2, 5, 0, 8, 6],
    goal: [1, 2, 3, 4, 5, 6, 7, 8, 0]
  }
};

let visualizer = null;
let currentSolverResult = null;

// Application Initialization on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  const defaultPreset = PRESETS.assignment;

  // Initialize visualizer with default assignment boards
  visualizer = new PuzzleVisualizer({
    initialBoard: defaultPreset.initial,
    goalBoard: defaultPreset.goal,
    onTileManualClick: handleManualTileClick
  });

  // Bind UI Controls
  setupPresetSelector();
  setupRandomGenerator();
  setupManualBoardInputs();
  setupHeuristicSelector();
  setupSolveButton();
  setupTabNavigation();

  // Run initial solve to ready the visualization immediately
  runSolver(false);
}

/**
 * Handles preset dropdown change
 */
function setupPresetSelector() {
  const presetSelect = document.getElementById('presetSelector');
  if (!presetSelect) return;

  presetSelect.addEventListener('change', (e) => {
    const key = e.target.value;
    if (PRESETS[key]) {
      const preset = PRESETS[key];
      visualizer.setBoards(preset.initial, preset.goal);
      syncInputFields(preset.initial, preset.goal);
      showToast(`Loaded: ${preset.name}`, 'info');
      runSolver(false);
    }
  });
}

/**
 * Random Solvable Puzzle Generator
 */
function setupRandomGenerator() {
  const btnRandom = document.getElementById('btnRandomScramble');
  const difficultySelect = document.getElementById('randomDifficulty');

  if (!btnRandom) return;

  btnRandom.addEventListener('click', () => {
    const stepsMap = {
      easy: 6,
      medium: 14,
      hard: 22
    };
    const difficulty = difficultySelect ? difficultySelect.value : 'medium';
    const steps = stepsMap[difficulty] || 14;

    const scrambled = PuzzleUtils.generateRandomSolvable(visualizer.goalBoard, steps);
    visualizer.setBoards(scrambled, visualizer.goalBoard);
    syncInputFields(scrambled, visualizer.goalBoard);

    showToast(`Generated random solvable puzzle (${difficulty}, ~${steps} scramble steps)`, 'success');
    runSolver(false);
  });
}

/**
 * Heuristic Selection and formula description update
 */
function setupHeuristicSelector() {
  const selector = document.getElementById('heuristicSelector');
  const descContainer = document.getElementById('heuristicFormulaDesc');

  if (!selector) return;

  const descriptions = {
    manhattan: `
      <div class="text-xs text-sky-300 font-mono">h(n) = &Sigma; (|row<sub>i</sub> - row<sub>goal</sub>| + |col<sub>i</sub> - col<sub>goal</sub>|)</div>
      <p class="text-[11px] text-slate-400 mt-1">Taxi-cab grid distance. Admissible, consistent, and dominates misplaced tiles.</p>
    `,
    misplaced: `
      <div class="text-xs text-amber-300 font-mono">h(n) = &Sigma; [tile<sub>i</sub> &ne; goal<sub>i</sub>] (blank excluded)</div>
      <p class="text-[11px] text-slate-400 mt-1">Counts misplaced tiles. Admissible & consistent, expands more nodes than Manhattan.</p>
    `,
    linearConflict: `
      <div class="text-xs text-emerald-300 font-mono">h(n) = Manhattan + 2 &times; (Linear Conflicts)</div>
      <p class="text-[11px] text-slate-400 mt-1">Enhanced admissible heuristic. Penalizes reversed tiles in correct row/column.</p>
    `
  };

  selector.addEventListener('change', () => {
    if (descContainer) {
      descContainer.innerHTML = descriptions[selector.value] || '';
    }
  });
}

/**
 * Manual board inputs modal / inline controls
 */
function setupManualBoardInputs() {
  const btnApplyManual = document.getElementById('btnApplyCustomState');
  const initialInput = document.getElementById('initialStateInput');
  const goalInput = document.getElementById('goalStateInput');
  const parityNotice = document.getElementById('parityValidationNotice');

  // Live validator on typing
  const validateInputs = () => {
    const initBoard = PuzzleUtils.parseBoardInput(initialInput.value);
    const goalBoard = PuzzleUtils.parseBoardInput(goalInput.value);

    if (!initBoard || !goalBoard) {
      if (parityNotice) {
        parityNotice.className = 'text-xs text-rose-400 p-2 rounded bg-rose-950/60 border border-rose-800';
        parityNotice.textContent = 'Invalid input: enter exactly 9 numbers (0-8 or 1-8 and _) with no duplicates.';
      }
      return false;
    }

    const initInversions = new PuzzleState(initBoard).getInversions();
    const goalInversions = new PuzzleState(goalBoard).getInversions();
    const solvable = (initInversions % 2) === (goalInversions % 2);

    if (parityNotice) {
      if (solvable) {
        parityNotice.className = 'text-xs text-emerald-400 p-2 rounded bg-emerald-950/60 border border-emerald-800';
        parityNotice.innerHTML = `&check; Solvable! Initial inversions: <strong>${initInversions}</strong>, Goal inversions: <strong>${goalInversions}</strong> (Parity matches).`;
      } else {
        parityNotice.className = 'text-xs text-amber-400 p-2 rounded bg-amber-950/60 border border-amber-800';
        parityNotice.innerHTML = `&times; UNSOLVABLE: Initial inversions: <strong>${initInversions}</strong> (${initInversions % 2 ? 'odd' : 'even'}), Goal: <strong>${goalInversions}</strong> (${goalInversions % 2 ? 'odd' : 'even'}). Parity mismatch.`;
      }
    }

    return true;
  };

  if (initialInput && goalInput) {
    initialInput.addEventListener('input', validateInputs);
    goalInput.addEventListener('input', validateInputs);
  }

  if (btnApplyManual) {
    btnApplyManual.addEventListener('click', () => {
      const initBoard = PuzzleUtils.parseBoardInput(initialInput.value);
      const goalBoard = PuzzleUtils.parseBoardInput(goalInput.value);

      if (!initBoard || !goalBoard) {
        showToast('Please provide valid 9-element boards (digits 0-8 without duplicates)', 'error');
        return;
      }

      visualizer.setBoards(initBoard, goalBoard);
      showToast('Custom puzzle configuration applied', 'info');
      runSolver(false);
    });
  }

  syncInputFields(visualizer.initialBoard, visualizer.goalBoard);
}

function syncInputFields(initialBoard, goalBoard) {
  const initialInput = document.getElementById('initialStateInput');
  const goalInput = document.getElementById('goalStateInput');
  if (initialInput) initialInput.value = initialBoard.join(' ');
  if (goalInput) goalInput.value = goalBoard.join(' ');

  const initialInversions = new PuzzleState(initialBoard).getInversions();
  const goalInversions = new PuzzleState(goalBoard).getInversions();
  const parityNotice = document.getElementById('parityValidationNotice');
  if (parityNotice) {
    const solvable = (initialInversions % 2) === (goalInversions % 2);
    parityNotice.className = solvable
      ? 'text-xs text-emerald-400 p-2 rounded bg-emerald-950/60 border border-emerald-800'
      : 'text-xs text-amber-400 p-2 rounded bg-amber-950/60 border border-amber-800';
    parityNotice.innerHTML = solvable
      ? `&check; Solvable: Initial inv = ${initialInversions}, Goal inv = ${goalInversions}`
      : `&times; Unsolvable: Inversion parity mismatch`;
  }
}

/**
 * Handle manual clicking of an adjacent tile on the board
 */
function handleManualTileClick(clickedIndex) {
  const blankIdx = visualizer.currentBoard.indexOf(0);
  const curRow = Math.floor(clickedIndex / 3);
  const curCol = clickedIndex % 3;
  const blankRow = Math.floor(blankIdx / 3);
  const blankCol = blankIdx % 3;

  if (Math.abs(curRow - blankRow) + Math.abs(curCol - blankCol) === 1) {
    // Determine movement direction for slide animation
    let animationClass = '';
    if (curRow < blankRow) animationClass = 'tile-slide-down';
    else if (curRow > blankRow) animationClass = 'tile-slide-up';
    else if (curCol < blankCol) animationClass = 'tile-slide-right';
    else if (curCol > blankCol) animationClass = 'tile-slide-left';

    const movedTile = visualizer.currentBoard[clickedIndex];
    visualizer.currentBoard[blankIdx] = movedTile;
    visualizer.currentBoard[clickedIndex] = 0;

    // Update initial reference to this state
    visualizer.initialBoard = [...visualizer.currentBoard];
    visualizer.render(movedTile, animationClass);
    visualizer.renderMiniBoard(visualizer.initialBoardElement, visualizer.initialBoard, 'initial');
    syncInputFields(visualizer.initialBoard, visualizer.goalBoard);

    // Re-run solver quietly in background
    runSolver(false);
  }
}

/**
 * Setup main Solve button
 */
function setupSolveButton() {
  const btnSolve = document.getElementById('btnSolveAStar');
  if (!btnSolve) return;

  btnSolve.addEventListener('click', () => {
    runSolver(true);
  });
}

/**
 * Solves using A* algorithm and updates visualization
 */
function runSolver(autoPlay = false) {
  const heuristicSelector = document.getElementById('heuristicSelector');
  const heuristicName = heuristicSelector ? heuristicSelector.value : 'manhattan';

  const solver = new AStarSolver({
    heuristicName: heuristicName,
    maxExpansions: 80000,
    maxTraceSteps: 400
  });

  const result = solver.solve(visualizer.initialBoard, visualizer.goalBoard);
  currentSolverResult = result;

  if (!result.found) {
    showToast(result.message || 'No solution could be found.', 'error');
    visualizer.loadSolution(result);
    return;
  }

  visualizer.loadSolution(result);

  // Render frontier preview if search steps are present
  if (result.searchSteps && result.searchSteps.length > 0) {
    const firstStep = result.searchSteps[0];
    visualizer.renderFrontier(firstStep.frontierSample);
  }

  if (autoPlay) {
    showToast(`Optimal solution found in ${result.executionTimeMs}ms (${result.movesCount} moves)! Starting animation...`, 'success');
    visualizer.play();
  } else {
    showToast(`A* solved: ${result.movesCount} moves, ${result.totalNodesExpanded} nodes expanded (${result.executionTimeMs}ms)`, 'info');
  }
}

/**
 * Tab Navigation (Visualizer vs Algorithm Guide)
 */
function setupTabNavigation() {
  const tabs = document.querySelectorAll('.nav-tab');
  const sections = document.querySelectorAll('.page-section');

  tabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
      e.preventDefault();
      const targetId = tab.dataset.target;

      tabs.forEach(t => {
        t.classList.remove('active', 'border-sky-500', 'text-sky-400');
        t.classList.add('border-transparent', 'text-slate-400');
      });

      tab.classList.add('active', 'border-sky-500', 'text-sky-400');
      tab.classList.remove('border-transparent', 'text-slate-400');

      sections.forEach(sec => {
        if (sec.id === targetId) {
          sec.classList.remove('hidden');
        } else {
          sec.classList.add('hidden');
        }
      });

      // Smooth scroll to view
      const targetElem = document.getElementById(targetId);
      if (targetElem) {
        targetElem.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });
}

/**
 * Toast notification banner helper
 */
function showToast(message, type = 'info') {
  const toast = document.getElementById('appToast');
  if (!toast) return;

  const bgTypes = {
    info: 'bg-slate-900/95 border-sky-500/50 text-sky-200',
    success: 'bg-emerald-950/95 border-emerald-500/50 text-emerald-200',
    error: 'bg-rose-950/95 border-rose-500/50 text-rose-200'
  };

  toast.className = `fixed bottom-6 right-6 z-50 max-w-md px-4 py-3 rounded-lg shadow-2xl border text-sm transition-all duration-300 flex items-center gap-3 ${bgTypes[type] || bgTypes.info}`;
  toast.innerHTML = `
    <span class="w-2 h-2 rounded-full ${type === 'success' ? 'bg-emerald-400' : type === 'error' ? 'bg-rose-400' : 'bg-sky-400'} animate-ping"></span>
    <span class="flex-1">${message}</span>
  `;

  toast.classList.remove('opacity-0', 'pointer-events-none', 'translate-y-4');
  toast.classList.add('opacity-100', 'translate-y-0');

  clearTimeout(toast.timeoutId);
  toast.timeoutId = setTimeout(() => {
    toast.classList.add('opacity-0', 'pointer-events-none', 'translate-y-4');
    toast.classList.remove('opacity-100', 'translate-y-0');
  }, 3500);
}
