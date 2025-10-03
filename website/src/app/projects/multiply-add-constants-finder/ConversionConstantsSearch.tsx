"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { DownDown, SmallButton, BigIntInput } from "../../../components/FormInputs";
import { ConversionCode } from "../../../components/multiply-add/CodeGen";
import { groupBy } from "../../../lib/util";
import {
    Bits,
    Problem,
    Range,
    RoundingMode,
    Solution,
    SolutionRange,
} from "../../../components/multiply-add/multiply-add-solver";

export interface ProblemDesc {
    rounding: RoundingMode;
    t: bigint;
    d: bigint;
    u: bigint;
    inputLimit?: number;
}
interface Result {
    problem: Problem;
    rounding: RoundingMode;
    bestSolution: Solution;
    addZero: Solution | undefined;
    iter: MaterializedIter<SolutionRange>;
    time: number;
}
function solve(desc: ProblemDesc): Result {
    const timeStart = performance.now();

    const p = Problem[desc.rounding](desc.u, desc.t, desc.d);

    let solver;
    try {
        solver = p.solve(desc.inputLimit);
    } catch (e) {
        // this means that we exceeded the input limit
        const primitive = p.simplify().primitiveSolution().original();

        return {
            problem: p,
            rounding: desc.rounding,
            bestSolution: primitive.optimize(desc.u),
            addZero: undefined,
            iter: MaterializedIter.of(SolutionRange.from(primitive)),
            time: performance.now() - timeStart,
        };
    }

    const iter = MaterializedIter.from(solver.iterateSolutions());
    iter.addMany(1); // add the minimal solution
    const smallest = iter.items[0].pickAny();
    const addZero = smallest.a === 0n ? smallest : solver.zeroSolution() ?? undefined;
    const bestSolution = pickBestSolution(smallest, addZero, desc.u);

    const timeUntilNow = performance.now() - timeStart;
    if (timeUntilNow < 5) {
        // if we found solutions very quickly, let's find some more for the user
        advanceSolutionIter(iter, 5, 50);
    }

    return {
        problem: p,
        rounding: desc.rounding,
        bestSolution,
        addZero,
        iter,
        time: performance.now() - timeStart,
    };
}

class MaterializedIter<T> {
    private _items: T[] = [];
    private _iter: Iterator<T>;
    private _done: boolean = false;

    get items(): readonly T[] {
        return this._items;
    }
    get finished(): boolean {
        return this._done;
    }

    constructor(iter: Iterator<T>) {
        this._iter = iter;
    }

    static from<T>(iterable: Iterable<T>): MaterializedIter<T> {
        return new MaterializedIter(iterable[Symbol.iterator]());
    }
    static of<T>(...items: readonly T[]): MaterializedIter<T> {
        const iter = new MaterializedIter(items[Symbol.iterator]());
        iter._items = [...items];
        iter._done = true;
        return iter;
    }

    addMany(count: number) {
        let i = 0;
        this.addWhile(() => ++i < count);
    }

    addWhile(cond: (item: T) => boolean) {
        while (!this._done) {
            const next = this._iter.next();
            if (next.done) {
                this._done = true;
            } else {
                this._items.push(next.value);
                if (!cond(next.value)) {
                    break;
                }
            }
        }
    }
}

function advanceSolutionIter(
    iter: MaterializedIter<SolutionRange>,
    maxIterTime: number, // ms
    maxSolutions: number,
) {
    if (iter.finished) return;

    const start = performance.now();
    let stopS = undefined;

    iter.addWhile((item) => {
        // check time
        const time = performance.now() - start;
        if (time >= maxIterTime) return false;

        // check max solutions
        maxSolutions--;
        if (maxSolutions <= 0) {
            // even if we have the required number of solutions, we want to
            // finish the current shift
            stopS ??= item.s + 1n;
            if (item.s !== stopS) return true;

            return false;
        }

        return true;
    });
}
function getVisibleSolution(iter: MaterializedIter<SolutionRange>): readonly SolutionRange[] {
    if (iter.finished || iter.items.length < 10) {
        return iter.items;
    }

    const last = iter.items[iter.items.length - 1];
    const prev = iter.items[iter.items.length - 2];
    if (last.s === prev.s) {
        return iter.items;
    }
    return iter.items.slice(0, -1);
}

function pickBestSolution(
    smallest: Solution,
    addZero: Solution | undefined,
    inputRange: bigint,
): Solution {
    if (addZero) {
        const smallestType = Bits.typeSize(smallest.requiredBits(inputRange).intermediate);
        const addZeroType = Bits.typeSize(addZero.requiredBits(inputRange).intermediate);
        if (addZeroType <= smallestType) {
            // this means that the zero solution doesn't require a jump to a
            // larger integer type, so it's typically better since it doesn't
            // need to do an addition
            return addZero.optimize(inputRange);
        }
    }

    return smallest.optimize(inputRange);
}

function updateFromUrlHash(old: ProblemDesc): ProblemDesc {
    const parseRounding = (value: string | null): RoundingMode | undefined => {
        const values: RoundingMode[] = ["round", "floor", "ceil"];
        if (!values.includes(value as never)) {
            return undefined;
        }
        return value as RoundingMode;
    };
    const parseInt = (value: string | null): bigint | undefined => {
        if (!value) {
            return undefined;
        }
        if (!/^\d+$/.test(value)) {
            return undefined;
        }
        return BigInt(value);
    };

    try {
        const hash = new URLSearchParams(window.location.hash.slice(1));
        const rounding = parseRounding(hash.get("r"));
        const t = parseInt(hash.get("t"));
        const d = parseInt(hash.get("d"));
        const u = parseInt(hash.get("u"));

        return {
            ...old,
            rounding: rounding ?? old.rounding,
            t: t ?? old.t,
            d: d ?? old.d,
            u: u ?? old.u,
        };
    } catch {
        return old;
    }
}
function updateUrlHash(problem: ProblemDesc) {
    const hash = new URLSearchParams();
    hash.set("r", problem.rounding);
    hash.set("t", String(problem.t));
    hash.set("d", String(problem.d));
    hash.set("u", String(problem.u));

    // replace the current URL
    history.replaceState(null, "", "#" + hash.toString());
}

const START_PROBLEM: ProblemDesc = {
    rounding: "round",
    t: 255n,
    d: 31n,
    u: 31n,
    inputLimit: 65536,
};
const START_SOLUTION = new Solution(527n, 23n, 6n);
const START_RESULT: Result = {
    problem: Problem.round(31n, 255n, 31n),
    rounding: "round",
    bestSolution: START_SOLUTION,
    addZero: undefined,
    iter: MaterializedIter.of(SolutionRange.from(START_SOLUTION)),
    time: 1,
};

export function ConversionConstantsSearch() {
    const [problem, setProblem] = useState<ProblemDesc>(START_PROBLEM);
    const [result, setResult] = useState<Result>(START_RESULT);

    // URL hash handling
    useEffect(() => {
        setProblem((old) => updateFromUrlHash(old));
    }, []);
    useEffect(() => {
        const timer = setTimeout(() => updateUrlHash(problem), 300);
        return () => clearTimeout(timer);
    }, [problem]);

    // solve
    useEffect(() => {
        // TODO: debounce?
        setResult(solve(problem));
    }, [problem]);

    // search more solutions
    const searchMore = useCallback(() => {
        const startTime = performance.now();
        advanceSolutionIter(result.iter, 500, 500);
        const time = performance.now() - startTime;
        setResult({ ...result, time: result.time + time });
    }, [result]);

    return (
        <>
            <ProblemInput problem={problem} setProblem={setProblem} />
            <SolutionOutput
                optimal={!result.iter.finished}
                best={result.bestSolution}
                addZero={result.addZero}
            />
            <ConversionCode
                problem={result.problem}
                solution={result.bestSolution}
                rounding={result.rounding}
            />
            <AllSolutions
                problem={result.problem}
                time={result.time}
                solutions={getVisibleSolution(result.iter)}
                searchMore={result.iter.finished ? undefined : searchMore}
            />
        </>
    );
}

interface ProblemInputProps {
    problem: ProblemDesc;
    setProblem: (value: React.SetStateAction<ProblemDesc>) => void;
}
export const ProblemInput = memo(({ problem, setProblem }: ProblemInputProps) => {
    const { u, d, t, rounding } = problem;

    const setInputRange = (value: bigint) => setProblem((p) => ({ ...p, u: value }));
    const setDenominator = (value: bigint) => setProblem((p) => ({ ...p, d: value }));
    const setEnumerator = (value: bigint) => setProblem((p) => ({ ...p, t: value }));
    const setRounding = (value: RoundingMode) => setProblem((p) => ({ ...p, rounding: value }));

    return (
        <>
            <div className="narrow mt-5">
                <div className="mb-1 flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="rounding"
                    >
                        Rounding <span className="border-b-2 border-yellow-500">(r)</span>
                    </label>
                    <DownDown
                        id="rounding"
                        value={rounding}
                        onChange={setRounding}
                        className="w-full sm:max-w-64"
                        options={["round", "floor", "ceil"]}
                    />
                </div>
                <div className="mb-1 flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="enumerator"
                    >
                        Enumerator <span className="border-b-2 border-emerald-400">(t)</span>
                    </label>
                    <BigIntInput
                        id="enumerator"
                        min={1n}
                        className="w-full min-w-0 sm:max-w-64"
                        value={t}
                        onChange={setEnumerator}
                    />
                </div>
                <div className="mb-1 flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="denominator"
                    >
                        Denominator <span className="border-b-2 border-red-600">(d)</span>
                    </label>
                    <BigIntInput
                        id="denominator"
                        min={1n}
                        className="w-full min-w-0 sm:max-w-64"
                        value={d}
                        onChange={setDenominator}
                    />
                </div>
                <div className="flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="inputRange"
                    >
                        Input range <span className="border-b-2 border-slate-500">(u)</span>
                    </label>
                    <div className="flex w-full flex-row flex-wrap gap-x-2 gap-y-1">
                        <BigIntInput
                            id="inputRange"
                            min={1n}
                            value={u}
                            className="w-full min-w-0 sm:max-w-64"
                            onChange={setInputRange}
                        />
                        <span className="flex flex-wrap gap-1">
                            <UButton inputRange={u} setInputRange={setInputRange} bits={8} />
                            <UButton inputRange={u} setInputRange={setInputRange} bits={16} />
                            <UButton inputRange={u} setInputRange={setInputRange} bits={24} />
                            <UButton inputRange={u} setInputRange={setInputRange} bits={32} />
                            <UButton inputRange={u} setInputRange={setInputRange} bits={64} />
                        </span>
                    </div>
                </div>
            </div>

            <div className="narrow xs:flex mt-4">
                <div className="xs:inline-block xs:w-32 xs:text-right mr-2 shrink-0 text-center leading-7 text-zinc-300">
                    The Problem:
                </div>
                <div className="xs:text-left text-center font-serif text-lg text-zinc-100">
                    <label
                        className="cursor-text border-b-2 border-yellow-500 pb-0.5"
                        htmlFor="rounding"
                    >
                        {rounding}
                    </label>
                    (<em>x</em> •{" "}
                    <label
                        className="cursor-text border-b-2 border-emerald-400 pb-0.5"
                        htmlFor="enumerator"
                    >
                        {String(t)}
                    </label>{" "}
                    /{" "}
                    <label
                        className="cursor-text border-b-2 border-red-600 pb-0.5"
                        htmlFor="denominator"
                    >
                        {String(d)}
                    </label>
                    ){" "}
                    <span className="whitespace-nowrap">
                        for <em>x</em> in{" "}
                        <label className="cursor-text" htmlFor="inputRange">
                            0..=
                            <span className="border-b-2 border-slate-500 pb-0.5">{String(u)}</span>
                        </label>
                    </span>
                </div>
            </div>
        </>
    );
});

interface SolutionOutputProps {
    optimal: boolean;
    best: Solution;
    addZero?: Solution;
}
const SolutionOutput = memo(({ optimal, best }: SolutionOutputProps) => {
    let expression = <em>x</em>;

    if (best.f !== 1n) {
        expression = (
            <>
                {expression} • {String(best.f)}
            </>
        );
    }
    if (best.a !== 0n) {
        expression = (
            <>
                {expression} + {String(best.a)}
            </>
        );
    }
    if (best.s > 0) {
        const shift = <span className="whitespace-nowrap">&gt;&gt; {String(best.s)}</span>;
        expression =
            best.a === 0n ? (
                <>
                    {expression} {shift}
                </>
            ) : (
                <>
                    ({expression}) {shift}
                </>
            );
    }

    return (
        <>
            <div className="narrow xs:flex my-8">
                <div className="xs:inline-block xs:w-32 xs:text-right mr-2 shrink-0 text-center leading-6 text-zinc-300">
                    Best Solution:
                </div>
                <div className="xs:text-left text-center font-serif text-lg leading-6 text-zinc-100">
                    {expression}
                    {!optimal && (
                        <span
                            title="This solution is correct but may not be optimal."
                            className="cursor-help"
                        >
                            {" ⚠️"}
                        </span>
                    )}
                </div>
            </div>
            {/* <div className="narrow xs:flex mt-2 mb-8">
                <div className="xs:inline-block xs:w-32 xs:text-right mr-2 shrink-0 text-center leading-6 text-zinc-300">
                    Zero Solution:
                </div>
                <div className="xs:text-left text-center font-serif text-lg leading-6 text-zinc-100">
                    {addZero ? (
                        <>
                            <em>s</em>={String(addZero.s)}
                            <span className="inline-block w-2" /> <em>f</em>={String(addZero.f)}
                            <span className="inline-block w-2" /> <em>a</em>={String(addZero.a)}
                        </>
                    ) : (
                        <>
                            no solutions with <em>a</em>=0 exist
                        </>
                    )}
                </div>
            </div> */}
        </>
    );
});

interface UButtonProps {
    inputRange: bigint;
    setInputRange: (value: bigint) => void;
    bits: number;
}
const UButton = memo(({ inputRange, setInputRange, bits }: UButtonProps) => {
    const u = (1n << BigInt(bits)) - 1n;
    return (
        <SmallButton
            selected={inputRange === u}
            onClick={() => setInputRange(u)}
            title={`Set input range to 2^${bits} - 1`}
        >
            u{bits}
        </SmallButton>
    );
});

interface AllSolutionsProps {
    problem: Problem;
    time: number;
    solutions: readonly SolutionRange[];
    searchMore?: () => void;
}
const AllSolutions = memo(({ problem, time, solutions, searchMore }: AllSolutionsProps) => {
    const formatDuration = (time: number) => {
        if (time < 0.1) {
            return "<0.1ms";
        }
        if (time < 10) {
            return time.toFixed(1) + "ms";
        }
        if (time < 1000) {
            return time.toFixed(0) + "ms";
        }
        return (time / 1000).toFixed(1) + "s";
    };

    const shifts = Array.from(groupBy(solutions, (s) => s.s));

    const resetKey = problem.toString();

    return (
        <div className="narrow my-8">
            <details>
                <summary className="w-fit cursor-pointer select-none rounded-md border-2 border-zinc-700 bg-black px-4 py-2 text-neutral-200 transition-colors hover:border-zinc-500 active:bg-slate-800 [&:not(:read-only)]:hover:text-white">
                    All solutions
                </summary>

                <div className="my-4">
                    Found {solutions.length} solution{solutions.length !== 1 && "s"} in{" "}
                    {formatDuration(time)}.
                </div>

                <div className="my-4" key={resetKey}>
                    {shifts.map(([shift, solutions]) => {
                        return <SolutionList key={shift} solutions={solutions} />;
                    })}
                </div>

                {searchMore ? <button onClick={searchMore}>Show more solution</button> : undefined}
            </details>
        </div>
    );
});

const SolutionList = memo(({ solutions }: { solutions: readonly SolutionRange[] }) => {
    if (solutions.length === 0) {
        throw new Error("No solutions");
    }

    const COMPACT_THRESHOLD = 8;
    const COMPACT_PADDING = 2;

    const [collapsed, setCollapsed] = useState(solutions.length >= COMPACT_THRESHOLD);

    const maxFactorLen = maxLen([solutions[0].f, solutions[solutions.length - 1].f]);
    const formatMany = (solutions: readonly SolutionRange[]) =>
        solutions.map((s) => formatSolution(s, maxFactorLen)).join("\n");

    const isCompact = collapsed && solutions.length >= COMPACT_THRESHOLD;

    return (
        <pre className="-mx-4 mb-4 overflow-auto whitespace-pre px-4 font-mono text-sm sm:mx-0 sm:px-0">
            {isCompact && (
                <>
                    {formatMany(solutions.slice(0, COMPACT_PADDING))}
                    {"\n"}
                    <span
                        className="cursor-pointer text-zinc-400 hover:text-white"
                        onClick={() => {
                            setCollapsed(false);
                        }}
                    >
                        {"... show " + (solutions.length - COMPACT_PADDING * 2) + " more"}
                    </span>
                    {"\n"}
                    {formatMany(solutions.slice(-COMPACT_PADDING))}
                </>
            )}
            {!isCompact && formatMany(solutions)}
        </pre>
    );
});

function maxLen(array: readonly unknown[]): number {
    return Math.max(...array.map((a) => String(a).length));
}
function formatAdd(add: Range): string {
    return add.min === add.max ? String(add.min) : add.min + "..=" + add.max;
}
function formatSolution(s: SolutionRange, maxFactorLen: number = 0): string {
    return `s=${s.s} f=${String(s.f).padEnd(maxFactorLen)} a=${formatAdd(s.A)}`;
}
