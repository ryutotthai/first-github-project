const boardElement = document.getElementById("board");
const turnIndicator = document.getElementById("turnIndicator");
const statusMessage = document.getElementById("statusMessage");
const movesList = document.getElementById("movesList");
const resetBtn = document.getElementById("resetBtn");

const files = ["a", "b", "c", "d", "e", "f", "g", "h"];

const pieceSymbols = {
  white: {
    king: "♔",
    queen: "♕",
    rook: "♖",
    bishop: "♗",
    knight: "♘",
    pawn: "♙",
  },
  black: {
    king: "♚",
    queen: "♛",
    rook: "♜",
    bishop: "♝",
    knight: "♞",
    pawn: "♟︎",
  },
};

const pieceNames = {
  king: "king",
  queen: "queen",
  rook: "rook",
  bishop: "bishop",
  knight: "knight",
  pawn: "pawn",
};

let state = createInitialState();

function createInitialState() {
  return {
    board: createInitialBoard(),
    currentPlayer: "white",
    selected: null,
    legalMoves: [],
    moves: [],
    gameOver: false,
    outcomeTitle: "",
    message: "Select a piece to see its legal moves.",
  };
}

function createInitialBoard() {
  const empty = Array.from({ length: 8 }, () => Array(8).fill(null));
  const backRank = ["rook", "knight", "bishop", "queen", "king", "bishop", "knight", "rook"];
  empty[0] = backRank.map((type) => createPiece(type, "black"));
  empty[1] = Array(8)
    .fill(null)
    .map(() => createPiece("pawn", "black"));
  empty[6] = Array(8)
    .fill(null)
    .map(() => createPiece("pawn", "white"));
  empty[7] = backRank.map((type) => createPiece(type, "white"));
  return empty;
}

function createPiece(type, color) {
  return { type, color, hasMoved: false };
}

function cloneBoard(board) {
  return board.map((row) => row.map((piece) => (piece ? { ...piece } : null)));
}

function renderBoard() {
  boardElement.innerHTML = "";
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const square = document.createElement("button");
      square.type = "button";
      square.dataset.row = row;
      square.dataset.col = col;
      square.className = `square ${isLightSquare(row, col) ? "light" : "dark"}`;
      square.disabled = state.gameOver;

      const piece = state.board[row][col];
      if (piece) {
        square.textContent = pieceSymbols[piece.color][piece.type];
      }

      if (state.selected && state.selected.row === row && state.selected.col === col) {
        square.classList.add("selected");
      }

      const move = state.legalMoves.find((m) => m.row === row && m.col === col);
      if (move) {
        square.classList.add(piece ? "capture-option" : "move-option");
      }

      const label = createSquareLabel(row, col, piece);
      square.title = label;
      square.setAttribute("aria-label", label);

      boardElement.appendChild(square);
    }
  }
}

function renderMoves() {
  movesList.innerHTML = "";
  state.moves.forEach((notation, index) => {
    const li = document.createElement("li");
    li.textContent = `${index + 1}. ${notation}`;
    movesList.appendChild(li);
  });
}

function updateHud({ inCheck = false } = {}) {
  if (state.gameOver) {
    turnIndicator.textContent = state.outcomeTitle;
  } else {
    const turnText = `${capitalize(state.currentPlayer)} to move`;
    turnIndicator.textContent = inCheck ? `${turnText} — check` : turnText;
  }
  statusMessage.textContent = state.message;
}

function createSquareLabel(row, col, piece) {
  const square = coordsToSquare(row, col);
  if (!piece) {
    return `Empty square ${square}`;
  }
  const pieceLabel = `${piece.color} ${pieceNames[piece.type]}`;
  return `${capitalize(pieceLabel)} on ${square}`;
}

function isLightSquare(row, col) {
  return (row + col) % 2 === 0;
}

function handleBoardClick(event) {
  const square = event.target.closest(".square");
  if (!square || state.gameOver) {
    return;
  }

  const row = Number(square.dataset.row);
  const col = Number(square.dataset.col);

  const chosenMove = state.legalMoves.find((move) => move.row === row && move.col === col);

  if (state.selected && chosenMove) {
    executeMove(state.selected, chosenMove);
    return;
  }

  const piece = state.board[row][col];
  if (piece && piece.color === state.currentPlayer) {
    if (state.selected && state.selected.row === row && state.selected.col === col) {
      clearSelection();
    } else {
      setSelection(row, col);
    }
  } else {
    clearSelection();
  }
}

function clearSelection() {
  state.selected = null;
  state.legalMoves = [];
  setMessage(`${capitalize(state.currentPlayer)} to move.`);
  refreshBoard();
}

function setSelection(row, col) {
  const moves = getLegalMoves(state.board, row, col, state.currentPlayer);
  state.selected = { row, col };
  state.legalMoves = moves;
  const piece = state.board[row][col];
  if (moves.length === 0) {
    setMessage(`No legal moves for the ${piece.color} ${pieceNames[piece.type]}.`);
  } else {
    setMessage(
      `${capitalize(piece.color)} ${pieceNames[piece.type]} on ${coordsToSquare(row, col)} ready.`
    );
  }
  refreshBoard();
}

function executeMove(from, move) {
  const movingPiece = state.board[from.row][from.col];
  const capturedPiece = state.board[move.row][move.col];
  const movingColor = movingPiece.color;
  const resultingType = move.promotion ? move.promotion : movingPiece.type;

  state.board = applyMove(state.board, from, move);
  state.selected = null;
  state.legalMoves = [];
  state.currentPlayer = movingColor === "white" ? "black" : "white";

  const opponent = state.currentPlayer;
  const opponentInCheck = isKingInCheck(state.board, opponent);
  const opponentHasMoves = playerHasMoves(state.board, opponent);
  const isMate = opponentInCheck && !opponentHasMoves;
  const isStalemate = !opponentInCheck && !opponentHasMoves;

  const notation = describeMove({
    pieceColor: movingColor,
    pieceType: resultingType,
    from,
    to: { row: move.row, col: move.col },
    capturedPiece,
    promotion: move.promotion,
    isCheck: opponentInCheck,
    isMate,
  });
  state.moves = [...state.moves, notation];

  if (isMate) {
    state.gameOver = true;
    state.outcomeTitle = `${capitalize(movingColor)} wins by checkmate`;
    setMessage(`Checkmate! ${capitalize(movingColor)} defeats ${capitalize(opponent)}.`);
  } else if (isStalemate) {
    state.gameOver = true;
    state.outcomeTitle = "Drawn game";
    setMessage("Stalemate! No legal moves remain.");
  } else {
    state.gameOver = false;
    if (opponentInCheck) {
      setMessage(`${capitalize(opponent)} is in check.`);
    } else {
      setMessage(`${capitalize(opponent)} to move.`);
    }
  }

  renderBoard();
  renderMoves();
  updateHud({ inCheck: opponentInCheck });
}

function refreshBoard() {
  renderBoard();
  updateHud();
}

function applyMove(board, from, move) {
  const updated = cloneBoard(board);
  const movingPiece = updated[from.row][from.col];
  updated[from.row][from.col] = null;
  const nextPiece = { ...movingPiece, hasMoved: true };
  if (move.promotion) {
    nextPiece.type = move.promotion;
  }
  updated[move.row][move.col] = nextPiece;
  return updated;
}

function getLegalMoves(board, row, col, color) {
  const piece = board[row][col];
  if (!piece || piece.color !== color) {
    return [];
  }

  const pseudoMoves = getPseudoMoves(board, row, col, { forAttack: false });
  return pseudoMoves.filter((move) => {
    const simulated = applyMove(board, { row, col }, move);
    return !isKingInCheck(simulated, color);
  });
}

function getPseudoMoves(board, row, col, { forAttack }) {
  const piece = board[row][col];
  if (!piece) {
    return [];
  }

  switch (piece.type) {
    case "pawn":
      return getPawnMoves(board, row, col, piece, forAttack);
    case "knight":
      return getKnightMoves(board, row, col, piece);
    case "bishop":
      return getSlidingMoves(board, row, col, piece, [
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
    case "rook":
      return getSlidingMoves(board, row, col, piece, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ]);
    case "queen":
      return getSlidingMoves(board, row, col, piece, [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
        [1, 1],
        [1, -1],
        [-1, 1],
        [-1, -1],
      ]);
    case "king":
      return getKingMoves(board, row, col, piece);
    default:
      return [];
  }
}

function getPawnMoves(board, row, col, piece, forAttack) {
  const moves = [];
  const direction = piece.color === "white" ? -1 : 1;
  const startRow = piece.color === "white" ? 6 : 1;
  const promotionRow = piece.color === "white" ? 0 : 7;

  const forwardRow = row + direction;
  if (!forAttack && isInsideBoard(forwardRow, col) && !board[forwardRow][col]) {
    moves.push({
      row: forwardRow,
      col,
      capture: false,
      promotion: forwardRow === promotionRow ? "queen" : undefined,
    });

    const doubleRow = row + direction * 2;
    if (
      row === startRow &&
      isInsideBoard(doubleRow, col) &&
      !board[doubleRow][col]
    ) {
      moves.push({ row: doubleRow, col, capture: false });
    }
  }

  [-1, 1].forEach((offset) => {
    const targetRow = row + direction;
    const targetCol = col + offset;
    if (!isInsideBoard(targetRow, targetCol)) {
      return;
    }
    const target = board[targetRow][targetCol];
    if (forAttack) {
      moves.push({
        row: targetRow,
        col: targetCol,
        capture: true,
        promotion: targetRow === promotionRow ? "queen" : undefined,
      });
    } else if (target && target.color !== piece.color) {
      moves.push({
        row: targetRow,
        col: targetCol,
        capture: true,
        promotion: targetRow === promotionRow ? "queen" : undefined,
      });
    }
  });

  return moves;
}

function getKnightMoves(board, row, col, piece) {
  const moves = [];
  const offsets = [
    [2, 1],
    [2, -1],
    [-2, 1],
    [-2, -1],
    [1, 2],
    [-1, 2],
    [1, -2],
    [-1, -2],
  ];
  for (const [dr, dc] of offsets) {
    const targetRow = row + dr;
    const targetCol = col + dc;
    if (!isInsideBoard(targetRow, targetCol)) {
      continue;
    }
    const target = board[targetRow][targetCol];
    if (!target || target.color !== piece.color) {
      moves.push({ row: targetRow, col: targetCol, capture: Boolean(target) });
    }
  }
  return moves;
}

function getSlidingMoves(board, row, col, piece, directions) {
  const moves = [];
  directions.forEach(([dr, dc]) => {
    let step = 1;
    while (true) {
      const targetRow = row + dr * step;
      const targetCol = col + dc * step;
      if (!isInsideBoard(targetRow, targetCol)) {
        break;
      }
      const target = board[targetRow][targetCol];
      if (!target) {
        moves.push({ row: targetRow, col: targetCol, capture: false });
      } else {
        if (target.color !== piece.color) {
          moves.push({ row: targetRow, col: targetCol, capture: true });
        }
        break;
      }
      step += 1;
    }
  });
  return moves;
}

function getKingMoves(board, row, col, piece) {
  const moves = [];
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) {
        continue;
      }
      const targetRow = row + dr;
      const targetCol = col + dc;
      if (!isInsideBoard(targetRow, targetCol)) {
        continue;
      }
      const target = board[targetRow][targetCol];
      if (!target || target.color !== piece.color) {
        moves.push({ row: targetRow, col: targetCol, capture: Boolean(target) });
      }
    }
  }
  return moves;
}

function isInsideBoard(row, col) {
  return row >= 0 && row < 8 && col >= 0 && col < 8;
}

function isKingInCheck(board, color) {
  const kingPosition = findKing(board, color);
  if (!kingPosition) {
    return false;
  }
  return isSquareAttacked(board, kingPosition.row, kingPosition.col, color === "white" ? "black" : "white");
}

function findKing(board, color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece && piece.type === "king" && piece.color === color) {
        return { row, col };
      }
    }
  }
  return null;
}

function isSquareAttacked(board, row, col, attackerColor) {
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const piece = board[r][c];
      if (!piece || piece.color !== attackerColor) {
        continue;
      }
      const moves = getPseudoMoves(board, r, c, { forAttack: true });
      if (moves.some((move) => move.row === row && move.col === col)) {
        return true;
      }
    }
  }
  return false;
}

function playerHasMoves(board, color) {
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      const piece = board[row][col];
      if (piece && piece.color === color) {
        if (getLegalMoves(board, row, col, color).length > 0) {
          return true;
        }
      }
    }
  }
  return false;
}

function describeMove({ pieceColor, pieceType, from, to, capturedPiece, promotion, isCheck, isMate }) {
  const colorLabel = capitalize(pieceColor);
  const fromSquare = coordsToSquare(from.row, from.col);
  const toSquare = coordsToSquare(to.row, to.col);
  const typeLabel = pieceNames[pieceType];

  let text = `${colorLabel} ${typeLabel} ${fromSquare} → ${toSquare}`;
  if (capturedPiece) {
    text += ` captures ${capturedPiece.color} ${pieceNames[capturedPiece.type]}`;
  }
  if (promotion) {
    text += " promoting to queen";
  }
  if (isMate) {
    text += " — checkmate!";
  } else if (isCheck) {
    text += " — check.";
  }
  return text;
}

function coordsToSquare(row, col) {
  return `${files[col]}${8 - row}`;
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function setMessage(text) {
  state.message = text;
}

function resetGame() {
  state = createInitialState();
  renderBoard();
  renderMoves();
  updateHud();
}

boardElement.addEventListener("click", handleBoardClick);
resetBtn.addEventListener("click", resetGame);

renderBoard();
renderMoves();
updateHud();
