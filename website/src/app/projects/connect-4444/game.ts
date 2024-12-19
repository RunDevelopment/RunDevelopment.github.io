/**
 * The ID of a player or empty.
 *
 * 0 is empty, 1 is player 1, 2 is player 2, etc.
 */
export type PlayerId = 0 | (number & { __playerId: never });
export const FIRST_PLAYER: PlayerId = 1 as PlayerId;

/**
 * Returns the ID of the opponent of the given player.
 */
export function getNextPlayer(player: PlayerId, board: BoardSettings): PlayerId {
    return ((player % board.playerCount) + 1) as PlayerId;
}
/**
 * Returns the ID of the player of the given player.
 */
export function getPrevPlayer(player: PlayerId, board: BoardSettings): PlayerId {
    return (((player - 1 + board.playerCount - 1) % board.playerCount) + 1) as PlayerId;
}

export type GameResult = GameResultWin | GameResultDraw | GameResultOngoing;
export interface GameResultWin {
    readonly kind: "win";
    readonly finished: true;
    winner: PlayerId;
    lines: WinningLine[];
}
export interface GameResultDraw {
    readonly kind: "draw";
    readonly finished: true;
}
export interface GameResultOngoing {
    readonly kind: "ongoing";
    readonly finished: false;
}

export const DRAW: GameResultDraw = { kind: "draw", finished: true };
export const ONGOING: GameResultOngoing = { kind: "ongoing", finished: false };

export type CellPos = [x: number, y: number];
export type WinningLine = CellPos[];

export interface BoardSettings {
    readonly width: number;
    readonly height: number;
    /** The number of players. At least 2. */
    readonly playerCount: number;
    /** The number of connected cells required to win. */
    readonly goal: number;
}

export interface ReadonlyGameBoard extends BoardSettings {
    /**
     * The cells of the grid.
     *
     * Note that cell `[0, 0]` is the top left corner.
     */
    readonly grid: readonly PlayerId[];

    get(x: number, y: number): PlayerId;
    copy(): GameBoard;

    canDrop(x: number): boolean;

    /**
     * Returns whether the given cell is part of a winning line.
     */
    isWinningCell(x: number, y: number): boolean;
    /**
     * Returns all lines at the given cell that win the game.
     */
    getWinningLines(x: number, y: number): WinningLine[];

    result(lastMove?: CellPos): GameResult;
}

export class GameBoard implements ReadonlyGameBoard {
    grid: PlayerId[];

    readonly width: number;
    readonly height: number;
    readonly playerCount: number;
    readonly goal: number;

    constructor({ width, height, playerCount, goal }: BoardSettings) {
        this.width = width;
        this.height = height;
        this.playerCount = playerCount;
        if (playerCount < 2) {
            throw new Error("Player count must be at least 2");
        }
        this.goal = goal;

        this.grid = new Array(width * height).fill(0);
    }

    get(x: number, y: number): PlayerId {
        return this.grid[y * this.width + x];
    }
    set(x: number, y: number, player: PlayerId): void {
        this.grid[y * this.width + x] = player;
    }

    copy(): GameBoard {
        const copy = new GameBoard(this);
        copy.grid = this.grid.slice();
        return copy;
    }

    canDrop(x: number): boolean {
        return this.get(x, 0) === 0;
    }
    drop(x: number, player: PlayerId): CellPos {
        const cell = this.tryDrop(x, player);
        if (!cell) {
            throw new Error("Cannot drop in column");
        }
        return cell;
    }
    tryDrop(x: number, player: PlayerId): CellPos | undefined {
        for (let y = this.height - 1; y >= 0; y--) {
            if (this.get(x, y) === 0) {
                this.set(x, y, player);
                return [x, y];
            }
        }
        return undefined;
    }

    isWinningCell(x: number, y: number): boolean {
        const player = this.get(x, y);

        const w = this.width;
        const h = this.height;

        {
            // check horizontal
            let xMin = x;
            while (xMin > 0 && this.get(xMin - 1, y) === player) {
                xMin--;
            }
            let xMax = x;
            while (xMax < w - 1 && this.get(xMax + 1, y) === player) {
                xMax++;
            }
            const count = xMax - xMin + 1;
            if (count >= this.goal) {
                return true;
            }
        }

        {
            // check vertical
            let yMin = y;
            while (yMin > 0 && this.get(x, yMin - 1) === player) {
                yMin--;
            }
            let yMax = y;
            while (yMax < h - 1 && this.get(x, yMax + 1) === player) {
                yMax++;
            }
            const count = yMax - yMin + 1;
            if (count >= this.goal) {
                return true;
            }
        }

        {
            // check diagonal /
            let up = 1;
            while (x + up < w && y - up >= 0 && this.get(x + up, y - up) === player) {
                up++;
            }
            up--;
            let down = 1;
            while (x - down >= 0 && y + down < h && this.get(x - down, y + down) === player) {
                down++;
            }
            down--;

            const count = up + down + 1;
            if (count >= this.goal) {
                return true;
            }
        }

        {
            // check diagonal \
            let up = 1;
            while (x + up < w && y + up < h && this.get(x + up, y + up) === player) {
                up++;
            }
            up--;
            let down = 1;
            while (x - down >= 0 && y - down >= 0 && this.get(x - down, y - down) === player) {
                down++;
            }
            down--;

            const count = up + down + 1;
            if (count >= this.goal) {
                return true;
            }
        }

        return false;
    }

    /**
     * Returns all lines at the given cell that win the game.
     */
    getWinningLines(x: number, y: number): WinningLine[] {
        const player = this.get(x, y);

        const w = this.width;
        const h = this.height;

        const lines: WinningLine[] = [];

        {
            // check horizontal
            let xMin = x;
            while (xMin > 0 && this.get(xMin - 1, y) === player) {
                xMin--;
            }
            let xMax = x;
            while (xMax < w - 1 && this.get(xMax + 1, y) === player) {
                xMax++;
            }
            const count = xMax - xMin + 1;
            if (count >= this.goal) {
                lines.push(Array.from({ length: count }, (_, i) => [xMin + i, y]));
            }
        }

        {
            // check vertical
            let yMin = y;
            while (yMin > 0 && this.get(x, yMin - 1) === player) {
                yMin--;
            }
            let yMax = y;
            while (yMax < h - 1 && this.get(x, yMax + 1) === player) {
                yMax++;
            }
            const count = yMax - yMin + 1;
            if (count >= this.goal) {
                lines.push(Array.from({ length: count }, (_, i) => [x, yMin + i]));
            }
        }

        {
            // check diagonal /
            let up = 1;
            while (x + up < w && y - up >= 0 && this.get(x + up, y - up) === player) {
                up++;
            }
            up--;
            let down = 1;
            while (x - down >= 0 && y + down < h && this.get(x - down, y + down) === player) {
                down++;
            }
            down--;

            const count = up + down + 1;
            if (count >= this.goal) {
                lines.push(Array.from({ length: count }, (_, i) => [x - down + i, y + down - i]));
            }
        }

        {
            // check diagonal \
            let up = 1;
            while (x + up < w && y + up < h && this.get(x + up, y + up) === player) {
                up++;
            }
            up--;
            let down = 1;
            while (x - down >= 0 && y - down >= 0 && this.get(x - down, y - down) === player) {
                down++;
            }
            down--;

            const count = up + down + 1;
            if (count >= this.goal) {
                lines.push(Array.from({ length: count }, (_, i) => [x - down + i, y - down + i]));
            }
        }

        return lines;
    }

    /**
     * Returns whether the board is full, meaning that it's a draw.
     */
    isFullBoard(): boolean {
        // we only need to check the top row
        for (let x = 0; x < this.width; x++) {
            if (this.grid[x] === 0) {
                return false;
            }
        }
        return true;
    }

    result(lastMove?: CellPos): GameResult {
        if (lastMove) {
            const lines = this.getWinningLines(...lastMove);
            if (lines.length > 0) {
                return {
                    kind: "win",
                    finished: true,
                    winner: this.get(...lastMove),
                    lines,
                };
            }
        } else {
            // try to find a winning line
            for (let y = 0; y < this.height; y++) {
                for (let x = 0; x < this.width; x++) {
                    const lines = this.getWinningLines(x, y);
                    if (lines.length > 0) {
                        return {
                            kind: "win",
                            finished: true,
                            winner: this.get(x, y),
                            lines,
                        };
                    }
                }
            }
        }

        // check for draw
        if (this.isFullBoard()) {
            return DRAW;
        }

        return ONGOING;
    }
}
