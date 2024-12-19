import {
    BoardSettings,
    CellPos,
    GameBoard,
    getNextPlayer,
    PlayerId,
    ReadonlyGameBoard,
} from "./game";

function getLegalMoves(board: ReadonlyGameBoard): number[] {
    const legalMoves: number[] = [];
    for (let x = 0; x < board.width; x++) {
        if (board.canDrop(x)) {
            legalMoves.push(x);
        }
    }
    return legalMoves;
}

function getOpponent(player: PlayerId, board: BoardSettings): PlayerId {
    return getNextPlayer(player, board);
}

function pickRandom<T>(arr: readonly T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}
function pickRandomWeighted<T>(arr: readonly { item: T; weight: number }[]): T {
    let totalWeight = 0;
    for (const { weight } of arr) {
        totalWeight += weight;
    }
    let random = Math.random() * totalWeight;
    for (const { item, weight } of arr) {
        random -= weight;
        if (random <= 0) {
            return item;
        }
    }
    return arr[arr.length - 1].item;
}

/**
 * This is called a "forced move", because we have no choice but to make it.
 *
 * This is the case is:
 *
 * 1. There is only one legal move.
 * 2. We can win the game with a single move.
 * 3. There is a move that would let the opponent win and we must block.
 */
function forcedMove(player: PlayerId, board: GameBoard): number | undefined {
    const legalMoves = getLegalMoves(board);

    // there is only one move
    if (legalMoves.length === 1) {
        return legalMoves[0];
    }

    // check if any moves are winning
    for (const move of legalMoves) {
        const cellPos = board.drop(move, player);
        const isWin = board.isWinningCell(...cellPos);
        board.set(...cellPos, 0);
        if (isWin) {
            return move;
        }
    }

    // block opponent from winning
    const opponent = getOpponent(player, board);
    for (const move of legalMoves) {
        const cellPos = board.drop(move, opponent);
        const isWin = board.isWinningCell(...cellPos);
        board.set(...cellPos, 0);
        if (isWin) {
            return move;
        }
    }

    if (board.playerCount >= 3) {
        // sometimes we have to work together with our opponents to block a win for another player
        const opponent2 = getOpponent(opponent, board);

        const winningMoves = legalMoves.filter((move) => {
            const cellPos = board.drop(move, opponent2);
            const isWin = board.isWinningCell(...cellPos);
            board.set(...cellPos, 0);
            return isWin;
        });

        if (winningMoves.length >= 2) {
            // opponent 1 can't block both moves at once, so we need to help.
            // however, we don't want to make a move that would let opponent 1 win,
            // so we need to check for that.
            for (const move of winningMoves) {
                const playerCellPos = board.drop(move, player);
                const oppCellPos = board.tryDrop(move, opponent);
                const win = oppCellPos && board.isWinningCell(...oppCellPos);
                board.set(...playerCellPos, 0);
                oppCellPos && board.set(...oppCellPos, 0);
                if (win) {
                    // opponent 1 would win if we make this move
                    continue;
                }
                return move;
            }
        }
        if (winningMoves.length === 1) {
            // in this case, we want to make opponent 1 waste their move by blocking opponent 2
            // however, if that block would let opponent 2 win, we need to step in
            const move = winningMoves[0];
            const oppCellPos = board.drop(move, opponent);
            const opp2CellPos = board.tryDrop(move, opponent2);
            const win = opp2CellPos && board.isWinningCell(...opp2CellPos);
            board.set(...oppCellPos, 0);
            opp2CellPos && board.set(...opp2CellPos, 0);
            if (win) {
                // opponent 2 would win if we don't make this move
                return move;
            }
        }
    }

    return undefined;
}

/**
 * Returns a list of moves that aren't downright stupid.
 */
function getAllowedMoves(player: PlayerId, boardView: ReadonlyGameBoard): number[] {
    const board = boardView instanceof GameBoard ? boardView : boardView.copy();

    // avoid moves that let the opponent win
    const legalMoves = getLegalMoves(board);
    if (legalMoves.length === 0) {
        return legalMoves;
    }

    // forced move
    const forced = forcedMove(player, board);
    if (forced !== undefined) {
        return [forced];
    }

    const opponent = getOpponent(player, board);
    const allowedMoves = legalMoves.filter((move) => {
        const playerPos = board.drop(move, player);
        const oppPos = board.tryDrop(move, opponent);
        if (oppPos) {
            const oppWin = board.isWinningCell(...oppPos);
            board.set(...playerPos, 0);
            board.set(...oppPos, 0);
            return !oppWin;
        } else {
            board.set(...playerPos, 0);
            return true;
        }
    });

    if (allowedMoves.length === 0) {
        // we've been outplayed. Any move we make results in a loss.
        return [pickRandom(legalMoves)];
    }

    return allowedMoves;
}

const SCORE_WIN = Infinity;
const SCORE_LOSS = -SCORE_WIN;
const SCORE_DRAW = 0;
/**
 * Scores the board for the given player, assuming that the given player makes the next move.
 */
function scoreBoardHeuristic(player: PlayerId, board: GameBoard): number {
    const scoreSingle = (player: PlayerId, hasNextMove: boolean): number => {
        let score = 0;

        // having moves to explore while limiting the freedom of out opponents is good
        score = (getAllowedMoves(player, board).length / board.width) * 5;

        for (let x = 0; x < board.width; x++) {
            let lastNonEmpty = -1;
            for (let y = board.height - 1; y >= 0; y--) {
                if (board.get(x, y) !== 0) {
                    lastNonEmpty = y;
                    continue;
                }

                board.set(x, y, player);
                const isWin = board.isWinningCell(x, y);
                board.set(x, y, 0);

                if (isWin) {
                    // how many cells above the last non-empty cell we are
                    const offset = y - lastNonEmpty;
                    if (hasNextMove && offset === 1) {
                        // we can win with this move
                        return SCORE_WIN;
                    }

                    // we like cells close to the bottom
                    score += 10 - offset;
                }
            }
        }

        return score;
    };

    // the score of the board is how well we are doing minus how well the opponents are doing
    let score = scoreSingle(player, true) * (board.playerCount - 1);
    for (
        let opponent = getOpponent(player, board);
        opponent != player;
        opponent = getOpponent(opponent, board)
    ) {
        score -= scoreSingle(opponent, false);
    }
    return score;
}

function minimax(
    player: PlayerId,
    maximizingPlayer: PlayerId,
    lastMove: CellPos,
    board: GameBoard,
    depth: number,
): number {
    // check if game ends
    if (board.isWinningCell(...lastMove)) {
        return board.get(...lastMove) === maximizingPlayer ? SCORE_WIN : SCORE_LOSS;
    } else if (board.isFullBoard()) {
        return SCORE_DRAW;
    }

    // check if we reached the maximum depth
    if (depth <= 0 && player === maximizingPlayer) {
        return scoreBoardHeuristic(player, board);
    }

    const moves = getAllowedMoves(player, board);

    // if there is only one move, we are forced to take it.
    // since this doesn't branch, we don't need to decrease the depth.
    if (moves.length === 1) {
        const cellPos = board.drop(moves[0], player);
        const moveValue = minimax(
            getOpponent(player, board),
            maximizingPlayer,
            cellPos,
            board,
            depth,
        );
        board.set(...cellPos, 0);
        return moveValue;
    }

    // classic minimax algorithm
    if (player === maximizingPlayer) {
        let value = -Infinity;

        for (const move of moves) {
            const cellPos = board.drop(move, player);
            const moveValue = minimax(
                getOpponent(player, board),
                maximizingPlayer,
                cellPos,
                board,
                depth - 1,
            );
            board.set(...cellPos, 0);
            value = Math.max(value, moveValue);

            if (value === SCORE_WIN) {
                return SCORE_WIN;
            }
        }

        return value;
    } else {
        let value = +Infinity;

        for (const move of moves) {
            const cellPos = board.drop(move, player);
            const moveValue = minimax(
                getOpponent(player, board),
                maximizingPlayer,
                cellPos,
                board,
                depth - 1,
            );
            board.set(...cellPos, 0);
            value = Math.min(value, moveValue);

            if (value === SCORE_LOSS) {
                return SCORE_LOSS;
            }
        }

        return value;
    }
}

/**
 * This AI just makes random non-stupid moves.
 */
export function easyAiNextMove(player: PlayerId, board: ReadonlyGameBoard): number {
    // make a random move
    return pickRandom(getAllowedMoves(player, board));
}

/**
 * This AI tried to look ahead a few moves to see if it can win.
 */
export function mediumAiNextMove(player: PlayerId, boardView: ReadonlyGameBoard): number {
    const board = boardView instanceof GameBoard ? boardView : boardView.copy();

    const allowedMoves = getAllowedMoves(player, board);
    if (allowedMoves.length === 1) {
        console.log("Forced move", allowedMoves[0]);
        // nothing we can do
        return allowedMoves[0];
    }

    const MAX_DEPTH = 2;

    const startTime = performance.now();
    const scoredMoves = allowedMoves.map((move) => {
        const cellPos = board.drop(move, player);
        const score = minimax(getOpponent(player, board), player, cellPos, board, MAX_DEPTH);
        board.set(...cellPos, 0);
        return { move, score };
    });
    const endTime = performance.now();
    console.log("Time taken to score player " + player + ":", Math.round(endTime - startTime));

    console.log("Scores", scoredMoves);

    // pick a winning move if possible
    const winningMoves = scoredMoves.filter((move) => move.score === SCORE_WIN);
    if (winningMoves.length > 0) {
        console.log("Winning moves", winningMoves);
        return pickRandom(winningMoves).move;
    }

    // avoid losing moves
    const goodMoves = scoredMoves.filter((move) => move.score !== SCORE_LOSS);
    if (goodMoves.length === 0) {
        console.log("Guaranteed loss");
        // we are going to lose no matter what
        return pickRandom(allowedMoves);
    }

    // make a random good move
    goodMoves.sort((a, b) => {
        return a.score - b.score;
    });
    // bias towards the better moves
    return pickRandomWeighted(goodMoves.map(({ move }, i) => ({ item: move, weight: i + 1 })));
}

/**
 * This AI tried to look ahead a few moves to see if it can win.
 */
export function hardAiNextMove(player: PlayerId, board: ReadonlyGameBoard): number {
    const allowedMoves = getAllowedMoves(player, board);

    // make a random move
    return pickRandom(allowedMoves);
}
