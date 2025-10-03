"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
    BoardSettings,
    FIRST_PLAYER,
    GameBoard,
    GameResult,
    getNextPlayer,
    ONGOING,
    PlayerId,
    ReadonlyGameBoard,
} from "./game";
import { easyAiNextMove, hardAiNextMove, mediumAiNextMove } from "./ai";

const HUMAN_SYMBOL = "🧠";
const AI_SYMBOL = "🤖";

type AiLevel = "easy" | "medium" | "hard";
type PlayerConfig = HumanPlayerConfig | AiPlayerConfig;
interface HumanPlayerConfig {
    readonly type: "human";
    readonly symbol: string;
}
interface AiPlayerConfig {
    readonly type: "ai";
    readonly symbol: string;
    readonly level: AiLevel;
}

class Players {
    readonly players: readonly PlayerConfig[];

    readonly count: number;
    readonly humanCount: number;
    readonly aiCount: number;

    constructor(players: readonly PlayerConfig[]) {
        if (players.length < 2) {
            throw new Error("At least 2 players are required");
        }
        this.players = players;

        this.count = players.length;
        this.humanCount = players.filter((p) => p.type === "human").length;
        this.aiCount = players.length - this.humanCount;
    }

    get(player: PlayerId): PlayerConfig {
        const p = this.players[player - 1];
        if (!p) {
            throw new Error(`Player ${player} does not exist`);
        }
        return p;
    }

    getPlayerName(player: PlayerId): `Player ${string}` | `Bot ${string}` | "You" {
        const p = this.get(player);
        if (p.type === "ai") {
            return `Bot ${player}`;
        }
        if (this.humanCount === 1) {
            return "You";
        }
        return `Player ${player}`;
    }
}

interface HistoryEntry {
    game: GameBoard;
    /** The player that can make the next move. */
    player: PlayerId;
}

export function GamePage() {
    const [state, setState] = useState<"menu" | "game">("menu");

    const [players, setPlayers] = useState<Players>(
        () =>
            new Players([
                { type: "human", symbol: HUMAN_SYMBOL },
                { type: "ai", symbol: AI_SYMBOL, level: "easy" },
            ]),
    );
    const [game, setGame] = useState<ReadonlyGameBoard>(
        () => new GameBoard({ width: 7, height: 6, playerCount: players.count, goal: 4 }),
    );
    const [player, setPlayer] = useState<PlayerId>(FIRST_PLAYER);
    const [gameResult, setGameResult] = useState<GameResult>(ONGOING);
    const [gameId, setGameId] = useState(0);
    const [history, setHistory] = useState<readonly HistoryEntry[]>([]);

    const drop = useCallback(
        (x: number) => {
            setHistory((history) => [...history, { game: game.copy(), player }]);

            const newGame = game.copy();
            const move = newGame.drop(x, player);
            setGame(newGame);
            const result = newGame.result(move);
            setGameResult(result);
            if (!result.finished) {
                setPlayer((player) => getNextPlayer(player, game));
            }
        },
        [game, player],
    );

    useEffect(() => {
        const currentPlayer = players.get(player);
        if (currentPlayer.type === "ai" && !gameResult.finished) {
            const levels: Record<AiLevel, (player: PlayerId, board: ReadonlyGameBoard) => number> =
                {
                    easy: easyAiNextMove,
                    medium: mediumAiNextMove,
                    hard: hardAiNextMove,
                };
            const ai = levels[currentPlayer.level];
            const timeout = setTimeout(() => {
                drop(ai(player, game));
            }, 100);
            return () => clearTimeout(timeout);
        }
    }, [player, players, drop, game, gameResult.finished]);

    return (
        <div className="text-[calc(min(2vh,2vw))]">
            {state === "menu" && (
                <GameModeSelect
                    settings={game}
                    players={players}
                    setGameMode={(players, settings) => {
                        setPlayers(players);
                        setGame(new GameBoard(settings));
                        setPlayer(FIRST_PLAYER);
                        setGameResult(ONGOING);
                        setState("game");
                        setGameId((id) => id + 1);
                    }}
                    close={() => setState("game")}
                />
            )}
            <GameControls
                players={players}
                settings={game}
                currentPlayer={player}
                result={gameResult}
                restart={() => {
                    setGame(new GameBoard(game));
                    setPlayer(FIRST_PLAYER);
                    setGameResult(ONGOING);
                    setGameId((id) => id + 1);
                }}
                selectGameMode={() => setState("menu")}
                undo={() => {
                    // rewind to the last human player
                    let i = history.length - 1;
                    while (i >= 0 && players.get(history[i].player).type === "ai") {
                        i--;
                    }
                    if (i >= 0) {
                        setGame(history[i].game);
                        setPlayer(history[i].player);
                        setGameResult(ONGOING);
                        setHistory(history.slice(0, i));
                    }
                }}
            />
            <BoardView
                key={gameId}
                board={game}
                nextDropPlayer={player}
                onColumnClick={drop}
                result={gameResult}
                readonly={gameResult.finished || players.get(player).type === "ai"}
            />
        </div>
    );
}

interface GameModeSelectProps {
    settings: BoardSettings;
    players: Players;
    setGameMode: (players: Players, settings: BoardSettings) => void;
    close: () => void;
}
function GameModeSelect({ settings, players, setGameMode }: GameModeSelectProps) {
    const [playerTypes, setPlayerTypes] = useState(players.players.map((p) => p.type));
    const [aiLevel, setAiLevel] = useState<AiLevel>(
        players.players.find((p) => p.type === "ai")?.level ?? "easy",
    );
    const [gridWidth, setGridWidth] = useState(settings.width);
    const [gridHeight, setGridHeight] = useState(settings.height);
    const [goal, setGoal] = useState(settings.goal);

    interface GameModePreset {
        name: string;
        players: PlayerConfig["type"][];
        gridWidth: number;
        gridHeight: number;
        goal: number;
    }
    const presets: GameModePreset[] = [
        { name: "Solo 1P", players: ["human", "ai"], gridWidth: 7, gridHeight: 6, goal: 4 },
        { name: "Classic 2P", players: ["human", "human"], gridWidth: 7, gridHeight: 6, goal: 4 },
        {
            name: "Squad 4P",
            players: ["human", "human", "human", "human"],
            gridWidth: 11,
            gridHeight: 8,
            goal: 3,
        },
        {
            name: "Party 6P",
            players: ["human", "human", "human", "human", "human", "human"],
            gridWidth: 15,
            gridHeight: 10,
            goal: 3,
        },
    ];

    const selectedPreset = presets.find(
        (p) =>
            JSON.stringify(p.players) === JSON.stringify(playerTypes) &&
            p.gridWidth === gridWidth &&
            p.gridHeight === gridHeight,
    );

    const AI_LEVELS: AiLevel[] = ["easy", "medium", "hard"];
    const AI_LEVEL_NAME: Record<AiLevel, string> = {
        easy: "Easy",
        medium: "Medium",
        hard: "Hard",
    };

    return (
        <div className="fixed left-0 top-0 z-10 h-screen w-screen bg-black/50 backdrop-blur-[calc(min(4vh,4vw))]">
            <div className="text-center">
                <div className="text-[500%]">Game Mode</div>

                <div>
                    <div className="mt-[.5em] inline-grid grid-cols-4 gap-[.4em] text-[200%] portrait:grid-cols-2 portrait:text-[300%]">
                        {presets.map((preset, i) => {
                            return (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setPlayerTypes(preset.players);
                                        setGridWidth(preset.gridWidth);
                                        setGridHeight(preset.gridHeight);
                                        setGoal(preset.goal);
                                    }}
                                    className={
                                        (preset === selectedPreset
                                            ? "border-white bg-black"
                                            : "border-white/30 hover:border-white/60 bg-transparent hover:bg-black/40") +
                                        " w-[6em] rounded-[1em] border-[.1em] py-[.2em] text-center active:scale-125 active:bg-black active:z-20 transition-all ease-out"
                                    }
                                >
                                    <span className="align-text-bottom">{preset.name}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-[1em] text-[200%] portrait:text-[250%]">
                    <div className="inline-flex gap-[.2em]">
                        {playerTypes.map((preset, i) => {
                            return (
                                <button
                                    key={i}
                                    onClick={() => {
                                        setPlayerTypes((types) => {
                                            const newTypes = [...types];
                                            newTypes[i] = newTypes[i] === "human" ? "ai" : "human";
                                            return newTypes;
                                        });
                                    }}
                                    className="group inline-block size-[2.75em] rounded-full border-[.2em] bg-black/50 transition-transform ease-out active:scale-125"
                                    style={{ borderColor: COLORS[i + 1] }}
                                >
                                    <span className="inline-block rounded-full text-[150%] transition-transform group-hover:scale-125">
                                        {preset === "human" ? HUMAN_SYMBOL : AI_SYMBOL}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="mt-[.3em] text-[125%] portrait:text-[155%]">
                    {playerTypes.map((preset, i) => {
                        return (
                            <React.Fragment key={i}>
                                {i > 0 && <span className="inline-block w-[1em]"> vs </span>}
                                <span className="inline-block w-[3.75em]">
                                    {preset === "human" ? "Player" : "Bot"}
                                </span>
                            </React.Fragment>
                        );
                    })}
                </div>

                <div className="mt-[.8em] text-[200%]">
                    <div className="inline-block select-none leading-[1em]">
                        <span>Bot Level:</span>
                        <button
                            onClick={() =>
                                setAiLevel((l) => AI_LEVELS[AI_LEVELS.indexOf(l) - 1] ?? l)
                            }
                            disabled={AI_LEVELS[0] === aiLevel}
                            className="inline-block size-[1em] bg-black"
                        >
                            -
                        </button>
                        <span className="inline-block w-[4em]">{AI_LEVEL_NAME[aiLevel]}</span>
                        <button
                            onClick={() =>
                                setAiLevel((l) => AI_LEVELS[AI_LEVELS.indexOf(l) + 1] ?? l)
                            }
                            disabled={AI_LEVELS[AI_LEVELS.length] === aiLevel}
                        >
                            +
                        </button>
                    </div>
                </div>

                <div className="mt-[1em] text-[200%]">
                    <div className="inline-block select-none leading-[1em]">
                        <span>Goal:</span>
                        <button
                            onClick={() => setGoal((g) => g - 1)}
                            disabled={goal <= 3}
                            className="inline-block size-[1em] bg-black"
                        >
                            -
                        </button>
                        <span className="inline-block w-[1em]">{goal}</span>
                        <button onClick={() => setGoal((g) => g + 1)} disabled={goal >= 5}>
                            +
                        </button>
                    </div>
                </div>

                <div className="text-[250%]">
                    <button
                        onClick={() => {
                            setGameMode(
                                new Players(
                                    playerTypes.map((type) =>
                                        type === "human"
                                            ? { type, symbol: HUMAN_SYMBOL }
                                            : { type, symbol: AI_SYMBOL, level: aiLevel },
                                    ),
                                ),
                                {
                                    width: gridWidth,
                                    height: gridHeight,
                                    playerCount: playerTypes.length,
                                    goal,
                                },
                            );
                        }}
                    >
                        Start Game!
                    </button>
                </div>
            </div>
        </div>
    );
}

interface GameControlsProps {
    players: Players;
    currentPlayer: PlayerId;
    settings: BoardSettings;
    result: GameResult;
    restart: () => void;
    selectGameMode: () => void;
    undo: () => void;
}
function GameControls({
    players,
    currentPlayer,
    settings,
    result,
    restart,
    selectGameMode,
    undo,
}: GameControlsProps) {
    const player = players.get(currentPlayer);
    const playerName = players.getPlayerName(currentPlayer);

    return (
        <div className="p-[1em]">
            <div className="text-center">
                <span>{players.count} Players - </span>
                <span className="whitespace-nowrap">First to Connect {settings.goal} Wins!</span>
                <span className="whitespace-nowrap" onClick={selectGameMode}>
                    {" "}
                    Change
                </span>
                <span className="whitespace-nowrap" onClick={restart}>
                    {" "}
                    Restart
                </span>
                <span className="whitespace-nowrap" onClick={undo}>
                    {" "}
                    Undo
                </span>
            </div>
            <div className="text-center">
                {result.kind === "win" && `${players.getPlayerName(result.winner)} won!`}
                {result.kind === "draw" && `Draw!`}
                {result.kind === "ongoing" &&
                    (player.type === "ai"
                        ? playerName + " is thinking..."
                        : `Your turn${players.humanCount === 1 ? "" : ", " + playerName}!`)}
            </div>
            <div className="text-center">
                <div className="inline-flex gap-[.5em]">
                    {players.players.map((p, i) => {
                        const active = i + 1 === currentPlayer;

                        return (
                            <span
                                key={i}
                                className={
                                    (active ? "opacity-100" : "opacity-60") +
                                    " transition-opacity inline-block size-[5.25em] rounded-full border-[.3em] bg-black/50"
                                }
                                style={{ borderColor: COLORS[i + 1] }}
                            >
                                <span
                                    className={
                                        (active ? "opacity-100" : "opacity-80") +
                                        " transition-opacity text-[300%]"
                                    }
                                >
                                    {p.symbol}
                                </span>
                            </span>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}

const COLORS = [
    "#333", // empty
    "#EE0", // player 1
    "#F20", // player 2
    "#33F", // player 3
    "#0F0", // player 4
    "#D0F", // player 5
    "#0FF", // player 6
];

function winningInfo(result: GameResult) {
    if (result.kind !== "win") {
        return undefined;
    }

    const winningCells = new Set(result.lines.flatMap((line) => line.map(([x, y]) => x + "," + y)));

    return {
        winningCells,
        lines: result.lines.map((line) => {
            return {
                x1: line[0][0],
                y1: line[0][1],
                x2: line[line.length - 1][0],
                y2: line[line.length - 1][1],
            };
        }),
    };
}

interface BoardViewProps {
    board: ReadonlyGameBoard;
    nextDropPlayer: PlayerId;
    readonly: boolean;
    onColumnClick: (x: number) => void;
    result: GameResult;
}
function BoardView({ board, nextDropPlayer, onColumnClick, result, readonly }: BoardViewProps) {
    const win = winningInfo(result);

    const hintLines = [];
    if (result.kind === "ongoing") {
        const boardCopy = board.copy();
        for (let y = 0; y < board.height; y++) {
            for (let x = 0; x < board.width; x++) {
                if (boardCopy.get(x, y) === 0) {
                    for (let player = 1; player <= board.playerCount; player++) {
                        boardCopy.set(x, y, player as PlayerId);
                        for (const line of boardCopy.getWinningLines(x, y)) {
                            if (line[0][0] === line[1][0]) {
                                // vertical
                                hintLines.push(
                                    <line
                                        key={hintLines.length}
                                        x1={0.5 + x}
                                        y1={0.5 + y}
                                        x2={0.5 + x}
                                        y2={0.9 + y}
                                        strokeWidth={0.1}
                                        stroke={COLORS[player]}
                                        strokeLinecap="round"
                                    />,
                                );
                            } else if (line[0][1] === line[1][1]) {
                                // horizontal
                                let nudge = 0;
                                let width = 0.5;
                                if (line[0][0] === x) {
                                    nudge = +0.15 + 0.1;
                                    width = 0.4;
                                } else if (line[line.length - 1][0] === x) {
                                    nudge = -0.15;
                                    width = 0.4;
                                }
                                hintLines.push(
                                    <line
                                        key={hintLines.length}
                                        x1={0.25 + x + nudge}
                                        y1={0.5 + y}
                                        x2={0.25 + x + nudge + width}
                                        y2={0.5 + y}
                                        strokeWidth={0.1}
                                        stroke={COLORS[player]}
                                        strokeLinecap="round"
                                    />,
                                );
                            } else if (line[0][1] === line[1][1] + 1) {
                                // diagonal /
                                let nudge = 0;
                                let width = 0.5;
                                if (line[0][0] === x) {
                                    nudge = 0.25;
                                    width = 0.52;
                                } else if (line[line.length - 1][0] === x) {
                                    nudge = -0.02;
                                    width = 0.25;
                                }
                                hintLines.push(
                                    <line
                                        key={hintLines.length}
                                        x1={0.25 + x + nudge}
                                        y1={0.75 + y - nudge}
                                        x2={0.25 + x + width}
                                        y2={0.75 + y - width}
                                        strokeWidth={0.1}
                                        stroke={COLORS[player]}
                                        strokeLinecap="round"
                                    />,
                                );
                            } else {
                                // diagonal \
                                let nudge = 0;
                                let width = 0.5;
                                if (line[0][0] === x) {
                                    nudge = 0.25;
                                    width = 0.52;
                                } else if (line[line.length - 1][0] === x) {
                                    nudge = -0.02;
                                    width = 0.25;
                                }
                                hintLines.push(
                                    <line
                                        key={hintLines.length}
                                        x1={0.25 + x + nudge}
                                        y1={0.25 + y + nudge}
                                        x2={0.25 + x + width}
                                        y2={0.25 + y + width}
                                        strokeWidth={0.1}
                                        stroke={COLORS[player]}
                                        strokeLinecap="round"
                                    />,
                                );
                            }
                        }
                    }
                    boardCopy.set(x, y, 0);
                }
            }
        }
    }

    return (
        <div
            className="relative mx-auto flex max-h-[calc(78vh)] max-w-[100vw]"
            style={{ aspectRatio: `${board.width}/${board.height}` }}
        >
            {result.kind === "win" && win && (
                <svg
                    className="pointer-events-none absolute size-full select-none"
                    viewBox={`0 0 ${board.width} ${board.height}`}
                >
                    {win.lines.map((win, i) => (
                        <line
                            key={i}
                            x1={0.5 + win.x1}
                            y1={0.5 + win.y1}
                            x2={0.5 + win.x2}
                            y2={0.5 + win.y2}
                            strokeWidth={0.1}
                            stroke={COLORS[result.winner]}
                        />
                    ))}
                </svg>
            )}
            {hintLines.length > 0 && (
                <svg
                    className="pointer-events-none absolute z-[1] size-full select-none"
                    viewBox={`0 0 ${board.width} ${board.height}`}
                >
                    {hintLines}
                </svg>
            )}
            <div className="flex size-full">
                {Array.from({ length: board.width }).map((_, x) => {
                    const canDrop = !readonly && !result.finished && board.canDrop(x);

                    return (
                        <div
                            key={x}
                            className={
                                (canDrop ? "cursor-pointer" : "cursor-not-allowed") +
                                " flex w-full flex-col group"
                            }
                            onClick={() => {
                                if (canDrop) {
                                    onColumnClick(x);
                                }
                            }}
                        >
                            {Array.from({ length: board.height }).map((_, y) => {
                                const player = board.get(x, y);
                                const isNextDrop =
                                    canDrop &&
                                    player === 0 &&
                                    (y === board.height - 1 || board.get(x, y + 1) !== 0);
                                const isWinning = win?.winningCells.has(x + "," + y) ?? false;

                                let currentState:
                                    | "empty"
                                    | "nextDrop"
                                    | "full"
                                    | "fullWin"
                                    | "fullFaded";
                                if (isNextDrop) {
                                    currentState = "nextDrop";
                                } else if (player === 0) {
                                    currentState = "empty";
                                } else if (result.finished) {
                                    currentState = isWinning ? "fullWin" : "fullFaded";
                                } else {
                                    currentState = "full";
                                }

                                return (
                                    <div key={y} className="grow p-[5%]">
                                        <div className="relative size-full">
                                            <div
                                                className="absolute size-full rounded-full"
                                                style={{ backgroundColor: COLORS[0] }}
                                            />
                                            <div
                                                className={
                                                    {
                                                        empty: "size-[70%] m-[15%] opacity-0",
                                                        nextDrop:
                                                            "size-[70%] m-[15%] opacity-0 group-hover:opacity-100",
                                                        full: "size-full opacity-100",
                                                        fullWin:
                                                            "size-full opacity-100 border-black border-2 border-solid",
                                                        fullFaded: "size-[90%] m-[5%] opacity-75",
                                                    }[currentState] +
                                                    " absolute rounded-full transition-opacity duration-500"
                                                }
                                                style={{
                                                    backgroundColor:
                                                        COLORS[player || nextDropPlayer],
                                                }}
                                            />
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
