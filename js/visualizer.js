/**
 * visualizer.js
 * Controls puzzle board DOM rendering, tile sliding animations,
 * interactive playback (play, pause, next, prev, scrub, speed),
 * live frontier display, and search process visual updates.
 */

class PuzzleVisualizer {
  constructor(options = {}) {
    // DOM Element hooks
    this.boardElement = document.getElementById('mainPuzzleBoard');
    this.goalBoardElement = document.getElementById('goalMiniBoard');
    this.initialBoardElement = document.getElementById('initialMiniBoard');
    this.successorsContainer = document.getElementById('successorsContainer');
    this.frontierListContainer = document.getElementById('frontierListContainer');

    // Control buttons
    this.btnRun = document.getElementById('btnRun');
    this.btnPause = document.getElementById('btnPause');
    this.btnResume = document.getElementById('btnResume');
    this.btnNext = document.getElementById('btnNext');
    this.btnPrev = document.getElementById('btnPrev');
    this.btnReset = document.getElementById('btnReset');
    this.speedSlider = document.getElementById('speedSlider');
    this.speedLabel = document.getElementById('speedLabel');
    this.stepSlider = document.getElementById('stepSlider');
    this.currentStepBadge = document.getElementById('currentStepBadge');
    this.totalStepsBadge = document.getElementById('totalStepsBadge');
    this.solutionTimeline = document.getElementById('solutionTimeline');

    // Metrics display elements
    this.metricMoves = document.getElementById('metricMoves');
    this.metricNodesGen = document.getElementById('metricNodesGen');
    this.metricNodesExp = document.getElementById('metricNodesExp');
    this.metricDepth = document.getElementById('metricDepth');
    this.metricTime = document.getElementById('metricTime');
    this.metricMemory = document.getElementById('metricMemory');
    this.metricF = document.getElementById('metricF');
    this.metricG = document.getElementById('metricG');
    this.metricH = document.getElementById('metricH');
    this.metricStatus = document.getElementById('metricStatus');

    // State tracking
    this.currentBoard = [...(options.initialBoard || [2, 8, 3, 1, 6, 4, 7, 0, 5])];
    this.initialBoard = [...this.currentBoard];
    this.goalBoard = [...(options.goalBoard || [1, 2, 3, 8, 0, 4, 7, 6, 5])];
    this.solutionPath = [];
    this.searchSteps = [];
    this.currentStepIndex = 0;
    this.isPlaying = false;
    this.timerId = null;
    this.stepDelayMs = 600; // Default speed
    this.onTileManualClick = options.onTileManualClick || null;

    this.initEventListeners();
    this.render();
    this.renderMiniBoard(this.goalBoardElement, this.goalBoard, 'goal');
    this.renderMiniBoard(this.initialBoardElement, this.initialBoard, 'initial');
  }

  /**
   * Initializes playback and interactive control events.
   */
  initEventListeners() {
    if (this.btnRun) {
      this.btnRun.addEventListener('click', () => this.play());
    }
    if (this.btnPause) {
      this.btnPause.addEventListener('click', () => this.pause());
    }
    if (this.btnResume) {
      this.btnResume.addEventListener('click', () => this.resume());
    }
    if (this.btnNext) {
      this.btnNext.addEventListener('click', () => this.nextStep());
    }
    if (this.btnPrev) {
      this.btnPrev.addEventListener('click', () => this.previousStep());
    }
    if (this.btnReset) {
      this.btnReset.addEventListener('click', () => this.resetToStart());
    }
    if (this.speedSlider) {
      this.speedSlider.addEventListener('input', (e) => {
        const val = parseInt(e.target.value, 10);
        // Slider value 1 (slow, 1200ms) to 10 (fast, 80ms)
        this.stepDelayMs = Math.max(60, 1300 - (val * 120));
        if (this.speedLabel) {
          this.speedLabel.textContent = `${this.stepDelayMs}ms`;
        }
        if (this.isPlaying) {
          this.pause();
          this.play();
        }
      });
    }
    if (this.stepSlider) {
      this.stepSlider.addEventListener('input', (e) => {
        const step = parseInt(e.target.value, 10);
        this.goToStep(step);
      });
    }
  }

  /**
   * Updates state boards and refreshes visualizer.
   */
  setBoards(initialBoard, goalBoard) {
    this.pause();
    this.initialBoard = [...initialBoard];
    this.currentBoard = [...initialBoard];
    this.goalBoard = [...goalBoard];
    this.solutionPath = [];
    this.searchSteps = [];
    this.currentStepIndex = 0;

    this.render();
    this.renderMiniBoard(this.goalBoardElement, this.goalBoard, 'goal');
    this.renderMiniBoard(this.initialBoardElement, this.initialBoard, 'initial');
    this.clearSuccessors();
    this.clearFrontier();
    this.updateControlsState();
    this.updateTimeline();
  }

  /**
   * Loads search results from A* Solver.
   */
  loadSolution(result) {
    this.solutionPath = result.path || [];
    this.searchSteps = result.searchSteps || [];
    this.currentStepIndex = 0;

    // Update summary metrics
    if (this.metricMoves) this.metricMoves.textContent = result.movesCount ?? 0;
    if (this.metricNodesGen) this.metricNodesGen.textContent = (result.totalNodesGenerated ?? 0).toLocaleString();
    if (this.metricNodesExp) this.metricNodesExp.textContent = (result.totalNodesExpanded ?? 0).toLocaleString();
    if (this.metricDepth) this.metricDepth.textContent = result.maxSearchDepth ?? 0;
    if (this.metricTime) this.metricTime.textContent = `${result.executionTimeMs ?? 0} ms`;
    if (this.metricMemory) this.metricMemory.textContent = `~${result.memoryUsageKB ?? 0} KB`;

    if (this.metricStatus) {
      if (result.found) {
        this.metricStatus.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-emerald-950/80 text-emerald-400 border border-emerald-500/30 flex items-center gap-1.5';
        this.metricStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span> Solution Found';
      } else {
        this.metricStatus.className = 'px-3 py-1 rounded-full text-xs font-semibold bg-rose-950/80 text-rose-400 border border-rose-500/30 flex items-center gap-1.5';
        this.metricStatus.innerHTML = '<span class="w-2 h-2 rounded-full bg-rose-400"></span> Unsolvable';
      }
    }

    if (this.stepSlider) {
      this.stepSlider.max = Math.max(0, this.solutionPath.length - 1);
      this.stepSlider.value = 0;
    }

    if (this.totalStepsBadge) {
      this.totalStepsBadge.textContent = Math.max(0, this.solutionPath.length - 1);
    }

    this.updateTimeline();
    this.goToStep(0);
  }

  /**
   * Renders the main 3x3 interactive board.
   */
  render(animatedTile = null, animationClass = '') {
    if (!this.boardElement) return;
    this.boardElement.innerHTML = '';

    const blankIdx = this.currentBoard.indexOf(0);
    const blankRow = Math.floor(blankIdx / 3);
    const blankCol = blankIdx % 3;

    // Check if entire board equals goal
    const isGoalReached = this.currentBoard.every((val, idx) => val === this.goalBoard[idx]);
    if (isGoalReached) {
      this.boardElement.classList.add('goal-celebrate');
    } else {
      this.boardElement.classList.remove('goal-celebrate');
    }

    for (let i = 0; i < 9; i++) {
      const tileValue = this.currentBoard[i];
      const row = Math.floor(i / 3);
      const col = i % 3;

      const tileDiv = document.createElement('div');
      tileDiv.dataset.index = i;
      tileDiv.dataset.value = tileValue;

      if (tileValue === 0) {
        tileDiv.className = 'puzzle-tile blank';
        tileDiv.innerHTML = '<span class="text-xs text-slate-500 font-mono">BLANK</span>';
      } else {
        const inGoal = (tileValue === this.goalBoard[i]);
        // A tile is movable if it is directly adjacent (Manhattan distance 1) to blank space
        const isAdjacentToBlank = (Math.abs(row - blankRow) + Math.abs(col - blankCol)) === 1;

        let classes = 'puzzle-tile';
        if (inGoal) classes += ' in-goal';
        if (isAdjacentToBlank && !this.isPlaying) classes += ' movable';

        // Apply animated slide class if this was the tile moved in this step
        if (animatedTile === tileValue && animationClass) {
          classes += ` ${animationClass}`;
        }

        tileDiv.className = classes;
        tileDiv.innerHTML = `
          <span>${tileValue}</span>
          <span class="tile-indicator absolute bottom-1 right-1.5 w-1.5 h-1.5 rounded-full ${inGoal ? 'bg-emerald-400' : 'bg-transparent'}"></span>
        `;

        if (isAdjacentToBlank && !this.isPlaying) {
          tileDiv.title = `Click to slide tile ${tileValue} into the blank slot`;
          tileDiv.addEventListener('click', () => {
            if (this.onTileManualClick) {
              this.onTileManualClick(i);
            }
          });
        }
      }

      this.boardElement.appendChild(tileDiv);
    }
  }

  /**
   * Renders miniature 3x3 boards for Goal and Initial reference.
   */
  renderMiniBoard(container, board, type = 'goal') {
    if (!container) return;
    container.innerHTML = '';

    for (let i = 0; i < 9; i++) {
      const val = board[i];
      const div = document.createElement('div');

      if (val === 0) {
        div.className = 'mini-tile blank';
        div.textContent = '';
      } else {
        const inGoal = (val === this.goalBoard[i]);
        div.className = `mini-tile ${inGoal ? 'in-goal' : ''}`;
        div.textContent = val;
      }
      container.appendChild(div);
    }
  }

  /**
   * Jumps to a specific step in the solution path.
   */
  goToStep(stepIndex) {
    if (!this.solutionPath || this.solutionPath.length === 0) return;
    if (stepIndex < 0 || stepIndex >= this.solutionPath.length) return;

    const previousStep = this.solutionPath[this.currentStepIndex];
    this.currentStepIndex = stepIndex;
    const currentStep = this.solutionPath[this.currentStepIndex];

    // Determine animation direction if advancing forward by 1 step
    let animationClass = '';
    if (previousStep && currentStep && stepIndex === previousStep.stepNumber + 1) {
      switch (currentStep.action) {
        case 'UP': animationClass = 'tile-slide-up'; break;
        case 'DOWN': animationClass = 'tile-slide-down'; break;
        case 'LEFT': animationClass = 'tile-slide-left'; break;
        case 'RIGHT': animationClass = 'tile-slide-right'; break;
      }
    }

    this.currentBoard = [...currentStep.board];
    this.render(currentStep.movedTile, animationClass);

    // Update real-time f, g, h for this step
    if (this.metricG) this.metricG.textContent = currentStep.g;
    if (this.metricH) this.metricH.textContent = currentStep.h;
    if (this.metricF) this.metricF.textContent = currentStep.f;

    if (this.currentStepBadge) {
      this.currentStepBadge.textContent = currentStep.stepNumber;
    }
    if (this.stepSlider) {
      this.stepSlider.value = currentStep.stepNumber;
    }

    // Update successors preview based on corresponding search step or current state successors
    this.renderSuccessorsForCurrentStep(currentStep);

    // Highlight timeline active step
    this.highlightActiveTimelineStep(this.currentStepIndex);
    this.updateControlsState();
  }

  /**
   * Renders the generated successor states panel for the current step.
   */
  renderSuccessorsForCurrentStep(stepNode) {
    if (!this.successorsContainer) return;
    this.successorsContainer.innerHTML = '';

    const state = new PuzzleState(stepNode.board);
    const successors = state.getSuccessors();

    if (successors.length === 0) {
      this.successorsContainer.innerHTML = '<div class="text-xs text-slate-400 italic">No valid successor moves.</div>';
      return;
    }

    successors.forEach(succ => {
      const hVal = Heuristics.manhattanDistance(succ.state.board, this.goalBoard);
      const gVal = stepNode.g + 1;
      const fVal = gVal + hVal;

      const card = document.createElement('div');
      card.className = 'successor-card bg-slate-800/60 border border-slate-700/60 rounded-lg p-2.5 flex items-center gap-3';

      // Action icon / badge
      const actionBadge = document.createElement('div');
      actionBadge.className = 'flex flex-col items-center justify-center w-14 h-14 rounded-md bg-slate-900 border border-slate-700 font-mono text-xs';
      let arrow = '•';
      if (succ.action === 'UP') arrow = '↑';
      if (succ.action === 'DOWN') arrow = '↓';
      if (succ.action === 'LEFT') arrow = '←';
      if (succ.action === 'RIGHT') arrow = '→';
      actionBadge.innerHTML = `<span class="text-lg text-sky-400 font-bold">${arrow}</span><span class="text-[10px] text-slate-400">${succ.action}</span>`;

      // Mini grid
      const miniGrid = document.createElement('div');
      miniGrid.className = 'grid grid-cols-3 gap-0.5 w-12 h-12 bg-slate-950 p-1 rounded border border-slate-800';
      for (const val of succ.state.board) {
        const cell = document.createElement('div');
        cell.className = `flex items-center justify-center text-[9px] font-bold rounded-sm ${val === 0 ? 'bg-slate-900 text-transparent' : 'bg-slate-700 text-slate-200'}`;
        cell.textContent = val === 0 ? '' : val;
        miniGrid.appendChild(cell);
      }

      // Cost metrics
      const details = document.createElement('div');
      details.className = 'flex-1 text-xs text-slate-300';
      details.innerHTML = `
        <div class="flex items-center justify-between text-[11px] mb-1">
          <span class="text-slate-400">Tile moved:</span>
          <span class="font-bold text-sky-300">${succ.movedTile}</span>
        </div>
        <div class="grid grid-cols-3 gap-1 text-center font-mono text-[10px] bg-slate-900/80 p-1 rounded">
          <div><span class="text-slate-500">g:</span> <span class="text-emerald-400">${gVal}</span></div>
          <div><span class="text-slate-500">h:</span> <span class="text-amber-400">${hVal}</span></div>
          <div><span class="text-slate-500">f:</span> <span class="text-sky-400 font-bold">${fVal}</span></div>
        </div>
      `;

      card.appendChild(actionBadge);
      card.appendChild(miniGrid);
      card.appendChild(details);
      this.successorsContainer.appendChild(card);
    });
  }

  /**
   * Renders the Frontier (Open List) preview.
   */
  renderFrontier(frontierSample) {
    if (!this.frontierListContainer) return;
    this.frontierListContainer.innerHTML = '';

    if (!frontierSample || frontierSample.length === 0) {
      this.frontierListContainer.innerHTML = `
        <div class="text-xs text-slate-500 text-center py-4 italic">
          Frontier is currently empty.
        </div>`;
      return;
    }

    frontierSample.forEach((node, idx) => {
      const row = document.createElement('div');
      row.className = 'flex items-center justify-between p-2 rounded-md bg-slate-900/70 border border-slate-800 hover:border-sky-500/50 text-xs font-mono transition';

      row.innerHTML = `
        <div class="flex items-center gap-2">
          <span class="w-5 h-5 rounded-full bg-slate-800 flex items-center justify-center text-[10px] text-sky-400 font-bold">#${idx + 1}</span>
          <span class="text-slate-300 font-sans font-semibold">${node.action || 'START'}</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-slate-400">g: <strong class="text-emerald-400">${node.g}</strong></span>
          <span class="text-slate-400">h: <strong class="text-amber-400">${node.h}</strong></span>
          <span class="px-2 py-0.5 rounded bg-sky-950 text-sky-300 font-bold border border-sky-800">f: ${node.f}</span>
        </div>
      `;
      this.frontierListContainer.appendChild(row);
    });
  }

  clearSuccessors() {
    if (this.successorsContainer) {
      this.successorsContainer.innerHTML = '<div class="text-xs text-slate-500 italic py-2">Click "Run A* Solver" to view generated successors.</div>';
    }
  }

  clearFrontier() {
    if (this.frontierListContainer) {
      this.frontierListContainer.innerHTML = '<div class="text-xs text-slate-500 italic py-2">Open list frontier will populate during search.</div>';
    }
  }

  /**
   * Generates interactive solution timeline chips.
   */
  updateTimeline() {
    if (!this.solutionTimeline) return;
    this.solutionTimeline.innerHTML = '';

    if (!this.solutionPath || this.solutionPath.length === 0) {
      this.solutionTimeline.innerHTML = '<span class="text-xs text-slate-500 italic">No solution computed yet.</span>';
      return;
    }

    this.solutionPath.forEach((step, idx) => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = `px-2.5 py-1 text-xs rounded-md font-mono transition flex items-center gap-1.5 flex-shrink-0 ${
        idx === this.currentStepIndex
          ? 'bg-sky-500 text-white font-bold ring-2 ring-sky-400'
          : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
      }`;
      chip.dataset.step = idx;

      let arrow = '●';
      if (step.action === 'UP') arrow = '↑';
      if (step.action === 'DOWN') arrow = '↓';
      if (step.action === 'LEFT') arrow = '←';
      if (step.action === 'RIGHT') arrow = '→';

      chip.innerHTML = `<span>${arrow}</span> <span>Step ${step.stepNumber}</span>`;
      chip.addEventListener('click', () => this.goToStep(idx));

      this.solutionTimeline.appendChild(chip);
    });
  }

  highlightActiveTimelineStep(stepIdx) {
    if (!this.solutionTimeline) return;
    const chips = this.solutionTimeline.querySelectorAll('button');
    chips.forEach((chip, idx) => {
      if (idx === stepIdx) {
        chip.className = 'px-2.5 py-1 text-xs rounded-md font-mono transition flex items-center gap-1.5 flex-shrink-0 bg-sky-500 text-white font-bold ring-2 ring-sky-400';
        chip.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
      } else {
        chip.className = 'px-2.5 py-1 text-xs rounded-md font-mono transition flex items-center gap-1.5 flex-shrink-0 bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200';
      }
    });
  }

  /**
   * Play / Autoplay loop.
   */
  play() {
    if (this.isPlaying) return;
    if (!this.solutionPath || this.solutionPath.length === 0) return;

    // If at end, wrap to start
    if (this.currentStepIndex >= this.solutionPath.length - 1) {
      this.currentStepIndex = 0;
      this.goToStep(0);
    }

    this.isPlaying = true;
    this.updateControlsState();

    this.timerId = setInterval(() => {
      if (this.currentStepIndex < this.solutionPath.length - 1) {
        this.nextStep();
      } else {
        this.pause();
      }
    }, this.stepDelayMs);
  }

  /**
   * Pause playback.
   */
  pause() {
    this.isPlaying = false;
    if (this.timerId) {
      clearInterval(this.timerId);
      this.timerId = null;
    }
    this.updateControlsState();
    this.render(); // Re-render to restore movable hover if applicable
  }

  nextStep() {
    if (!this.solutionPath || this.solutionPath.length === 0) return;
    if (this.currentStepIndex < this.solutionPath.length - 1) {
      this.goToStep(this.currentStepIndex + 1);
    }
  }

  previousStep() {
    if (!this.solutionPath || this.solutionPath.length === 0) return;
    if (this.currentStepIndex > 0) {
      this.goToStep(this.currentStepIndex - 1);
    }
  }

  resetToStart() {
    this.pause();
    this.goToStep(0);
  }

  resume() {
    this.play();
  }

  updateControlsState() {
    const hasPath = this.solutionPath && this.solutionPath.length > 0;
    const isAtStart = this.currentStepIndex === 0;
    const isAtEnd = hasPath && this.currentStepIndex === this.solutionPath.length - 1;

    if (this.btnRun) {
      this.btnRun.disabled = !hasPath || this.isPlaying;
      this.btnRun.classList.toggle('opacity-50', this.btnRun.disabled);
      this.btnRun.classList.toggle('cursor-not-allowed', this.btnRun.disabled);
    }

    if (this.btnPause) {
      this.btnPause.disabled = !this.isPlaying;
      this.btnPause.classList.toggle('opacity-50', this.btnPause.disabled);
      this.btnPause.classList.toggle('cursor-not-allowed', this.btnPause.disabled);
    }

    if (this.btnResume) {
      this.btnResume.disabled = !hasPath || this.isPlaying || isAtEnd;
      this.btnResume.classList.toggle('opacity-50', this.btnResume.disabled);
      this.btnResume.classList.toggle('cursor-not-allowed', this.btnResume.disabled);
    }

    if (this.btnPrev) {
      this.btnPrev.disabled = !hasPath || isAtStart || this.isPlaying;
      this.btnPrev.classList.toggle('opacity-50', this.btnPrev.disabled);
      this.btnPrev.classList.toggle('cursor-not-allowed', this.btnPrev.disabled);
    }

    if (this.btnNext) {
      this.btnNext.disabled = !hasPath || isAtEnd || this.isPlaying;
      this.btnNext.classList.toggle('opacity-50', this.btnNext.disabled);
      this.btnNext.classList.toggle('cursor-not-allowed', this.btnNext.disabled);
    }

    if (this.btnReset) {
      this.btnReset.disabled = !hasPath || isAtStart;
      this.btnReset.classList.toggle('opacity-50', this.btnReset.disabled);
      this.btnReset.classList.toggle('cursor-not-allowed', this.btnReset.disabled);
    }
  }
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PuzzleVisualizer };
}
