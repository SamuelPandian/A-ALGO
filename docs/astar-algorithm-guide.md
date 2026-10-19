# 8-Puzzle Solver: A* Search Algorithm Specification & Theory

## 1. Problem Formulation

The 8-Puzzle consists of a $3 \times 3$ grid with 8 numbered tiles (1 through 8) and an empty space (represented as `0` or `_`). The objective is to transition from an arbitrary solvable initial configuration to a target goal configuration using the minimum number of sliding moves.

### Formal State-Space Representation
* **States**: Any valid permutation of the 9 elements $\{0, 1, 2, 3, 4, 5, 6, 7, 8\}$ arranged in a $3 \times 3$ matrix.
* **Initial State**: The user-defined or benchmark board state.
* **Goal State**: Standard configuration (e.g. `[1, 2, 3, 8, 0, 4, 7, 6, 5]` or `[1, 2, 3, 4, 5, 6, 7, 8, 0]`).
* **Actions**: Moving the blank space `UP`, `DOWN`, `LEFT`, or `RIGHT` (equivalent to sliding an adjacent tile into the blank position).
* **Transition Model**: Swaps the blank tile with the adjacent tile in the direction of movement.
* **Step Cost $c(s, a, s')$**: Equal to $1$ for each move. Total path cost equals the number of moves.

---

## 2. Mathematical Solvability (Inversion Parity)

A random permutation of 9 tiles is **not always solvable**. The 8-puzzle state space is partitioned into two disjoint equivalence classes of size $\frac{9!}{2} = 181,440$ states each.

### Inversion Definition
An **inversion** occurs when a tile $A$ appears before tile $B$ in linear row-major order, but $A > B$ (ignoring the blank tile `0`).

$$\text{Inversions} = \sum_{i=1}^{8} \sum_{j=i+1}^{8} [A[i] > A[j] \land A[i] \neq 0 \land A[j] \neq 0]$$

### Parity Invariant Theorem
* Horizontal moves only change the position of the blank tile without changing the relative order of the numbered tiles ($\Delta \text{inversions} = 0$).
* Vertical moves shift a tile by 3 positions in row-major order, passing over exactly 2 other tiles. This changes the inversion count by $+2, 0,$ or $-2$.
* Consequently, the parity ($\text{inversions} \pmod 2$) is **strictly invariant** under all valid moves.
* **Solvability Condition**:
  $$\text{Inversions}(\text{Initial State}) \equiv \text{Inversions}(\text{Goal State}) \pmod 2$$

---

## 3. A* Search Algorithm Details

A* is a best-first graph search algorithm that expands nodes based on the evaluation function:

$$f(n) = g(n) + h(n)$$

Where:
* $g(n)$: Exact path cost accumulated from the start node to node $n$ (depth in unit-cost search).
* $h(n)$: Heuristic estimate of the cheapest path cost from node $n$ to the goal.
* $f(n)$: Estimated total cost of the lowest-cost path constrained to pass through node $n$.

### Pseudocode

```text
function A_STAR_SEARCH(initial_state, goal_state, heuristic):
    root_node = CreateNode(state=initial_state, parent=null, g=0, h=heuristic(initial_state, goal_state))
    frontier = PriorityQueue(ordered by f ascending, tie-breaker h ascending)
    frontier.insert(root_node)
    
    explored = HashMap() // maps state_string -> node
    open_map = HashMap() // maps state_string -> g_cost
    open_map.insert(initial_state.toString(), 0)

    while not frontier.isEmpty():
        current = frontier.pop()
        open_map.remove(current.state.toString())

        if explored.contains(current.state.toString()):
            continue

        explored.insert(current.state.toString(), current)

        if current.state == goal_state:
            return ReconstructPath(current)

        for action in valid_moves(current.state):
            child_state = apply_move(current.state, action)
            child_g = current.g + 1

            if explored.contains(child_state.toString()):
                continue

            if open_map.contains(child_state.toString()) and open_map[child_state.toString()] <= child_g:
                continue

            child_h = heuristic(child_state, goal_state)
            child_node = CreateNode(state=child_state, parent=current, g=child_g, h=child_h)
            
            frontier.insert(child_node)
            open_map[child_state.toString()] = child_g

    return FAILURE
```

---

## 4. Heuristic Functions Implemented

### 1. Manhattan Distance ($h_2$)
Computes the sum of taxi-cab distances each tile must traverse to reach its goal position:

$$h_2(n) = \sum_{t=1}^{8} \left( |r(t) - r_{\text{goal}}(t)| + |c(t) - c_{\text{goal}}(t)| \right)$$

* **Admissibility**: In a relaxed problem where tiles can move independently through each other, Manhattan distance is the exact number of moves required. Because the true game restricts moves to blank swaps, the relaxed cost never exceeds the true cost ($h_2(n) \le h^*(n)$).
* **Consistency (Monotonicity)**: A single move changes one tile's position by 1 grid unit. Therefore, $|h_2(n) - h_2(n')| \le 1 = c(n, a, n')$.

### 2. Misplaced Tiles ($h_1$)
Counts the number of numbered tiles not occupying their target coordinate:

$$h_1(n) = \sum_{i=1}^{8} [ \text{tile}_i \neq \text{goal}_i ]$$

* **Admissibility**: Every misplaced tile must be moved at least once to reach its destination.
* **Dominance**: For any state $n$, $h_2(n) \ge h_1(n)$. Manhattan distance dominates misplaced tiles, guaranteeing that A* expands fewer or equal nodes.

### 3. Manhattan + Linear Conflict ($h_3$)
Detects two tiles that are both in their target row (or column) but with reversed order. Resolving this necessitates at least one tile moving out of the lane and back, adding $+2$ moves:

$$h_3(n) = h_2(n) + 2 \times \text{Conflicts}(n)$$

---

## 5. Algorithmic Properties

| Property | A* Search Assessment |
| :--- | :--- |
| **Completeness** | Yes (provided branching factor $b \le 4$ and step costs $c \ge 1$) |
| **Optimality** | Yes (guaranteed shortest path with admissible/consistent heuristic) |
| **Time Complexity** | $O(b^d)$ where $b$ is effective branching factor and $d$ is solution depth |
| **Space Complexity** | $O(b^d)$ (must keep all generated nodes in memory) |
| **Data Structure** | Binary Min-Heap Priority Queue for $O(\log N)$ extraction |
