"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { NumberInput, DownDown, SmallButton } from "../../../components/FormInputs";
import init_gma, {
    Problem,
    SolutionIter as WasmSolutionIter,
    SolutionRange,
} from "@rundevelopment/gma_wasm";
import { bitsToTypeSize, ConversionCode } from "../../../components/multiply-add/CodeGen";
import {
    AddRangeLike,
    ProblemLike,
    SolutionLike,
    SolutionRangeLike,
} from "../../../components/multiply-add/interfaces";
import { groupBy } from "../../../lib/util";

interface Result {
    problem: ProblemLike;
    bestSolution: SolutionLike;
    addZero: SolutionLike | undefined;
    solutions: SolutionRangeLike[];
    time: number;
    hasMoreSolutions: boolean;
    getMoreSolutions: () => [solutions: SolutionRangeLike[], done: boolean];
}
type SolveFn = (problem: ProblemLike) => Result;

const dummyResult: Result = {
    problem: { rounding: "round", t: 255, d: 31, inputRange: 31 },
    bestSolution: { factor: 2108n, add: 92n, shift: 8 },
    addZero: undefined,
    solutions: [{ factor: 527n, add: { min: 23n, max: 23n }, shift: 6 }],
    time: 0,
    hasMoreSolutions: false,
    getMoreSolutions: () => [[], true],
};
const dummySolve: SolveFn = (problem) => {
    return { ...dummyResult, problem };
};
class SolutionIter {
    private iter: WasmSolutionIter;
    private back: SolutionRange | undefined;
    done: boolean = false;
    constructor(iter: WasmSolutionIter) {
        this.iter = iter;
    }
    next(): SolutionRange | undefined {
        if (this.back) {
            const s = this.back;
            this.back = undefined;
            return s;
        }
        const s = this.iter.next();
        if (s === undefined) {
            this.done = true;
        }
        return s;
    }
    putBack(s: SolutionRange) {
        if (this.back) {
            throw new Error("Can only put back one solution");
        }
        this.back = s;
    }
}
function iterateSolutionsWithinTimeFrame(
    iter: SolutionIter,
    maxIterTime: number,
    maxSolutions: number,
): SolutionRange[] {
    const solutions: SolutionRange[] = [];

    const iterStart = performance.now();
    let time = 0;
    let s;
    // iterate all solution until we take too long OR we have enough solutions
    while (time < maxIterTime && (s = iter.next())) {
        solutions.push(s);

        if (solutions.length >= maxSolutions) {
            break;
        }
        time = performance.now() - iterStart;
    }

    if (solutions.length > 0 && time < maxIterTime / 2) {
        // we still have a lot of time left, so let's get all solutions for
        // the last shift to finish it and then stop
        const shift = solutions[solutions.length - 1].shift;
        while ((s = iter.next())) {
            if (s.shift !== shift) {
                iter.putBack(s);
                break;
            }
            solutions.push(s);
        }
    }

    return solutions;
}
const wasmSolve: SolveFn = (p) => {
    const start = performance.now();

    const problem = new Problem(p.rounding, p.t, p.d, p.inputRange);

    const iter = new SolutionIter(problem.getSolutionRanges());
    const smallestSolution = iter.next()!;
    const addZero =
        smallestSolution.add.min === 0n
            ? smallestSolution.pickMin()
            : problem.getSmallestAddZeroSolution();

    const solutions = [smallestSolution];

    const MAX_SOLUTIONS = 50;
    const MAX_ITER_TIME = 10; // ms
    const FIRST_MAX_TIME = 30; // ms

    const iterStart = performance.now();
    let time = iterStart - start;
    // only iterate solution if the first solution was found quickly
    if (time < FIRST_MAX_TIME) {
        solutions.push(...iterateSolutionsWithinTimeFrame(iter, MAX_ITER_TIME, MAX_SOLUTIONS));
    }

    time = performance.now() - start;

    return {
        problem,
        bestSolution: pickBestSolution(smallestSolution.pickAny(), addZero, p.inputRange),
        solutions,
        addZero,
        time,
        hasMoreSolutions: !iter.done,
        getMoreSolutions: () => {
            const moreSolutions = iterateSolutionsWithinTimeFrame(iter, 500, 500);
            return [moreSolutions, iter.done];
        },
    };
};

function pickBestSolution(
    smallest: SolutionLike,
    addZero: SolutionLike | undefined,
    inputRange: number,
): SolutionLike {
    let best = smallest;
    const intermediateType = bitsToTypeSize(getIntermediateBits(best, inputRange));
    const outputRange = (BigInt(inputRange) * best.factor + best.add) >> BigInt(best.shift);
    const outputType = bitsToTypeSize(outputRange.toString(2).length);

    if (addZero && intermediateType === bitsToTypeSize(getIntermediateBits(addZero, inputRange))) {
        // this means that the zero solution doesn't require a jump to a
        // larger integer type, so it's better since it doesn't need to do
        // an addition
        best = addZero;
    }

    if (best.shift > 0 && best.factor !== 1n && intermediateType === outputType * 2) {
        // If the shift is that same as the output type, the compiler can
        // possibly optimize away the shift operation
        const preferredShift = outputType;
        if (preferredShift > best.shift) {
            const c = 2n ** BigInt(preferredShift - best.shift);
            const preferred: SolutionLike = {
                factor: best.factor * c,
                // choose a nice-looking add value if possible
                add:
                    best.add !== best.factor && best.add === 2n ** BigInt(best.shift) - 1n
                        ? 2n ** BigInt(preferredShift) - 1n
                        : best.add * c,
                shift: preferredShift,
            };

            const bestIntermediate = bitsToTypeSize(getIntermediateBits(best, inputRange));
            const preferredIntermediate = bitsToTypeSize(
                getIntermediateBits(preferred, inputRange),
            );
            if (bestIntermediate === preferredIntermediate) {
                // this means that the zero solution doesn't require a jump to a
                // larger integer type, so it's better since it doesn't need to do
                // an addition
                best = preferred;
            }
        }
    }

    return best;
}

function getIntermediateBits(solution: SolutionLike, inputRange: number): number {
    const maxIntermediate = BigInt(inputRange) * solution.factor + solution.add;
    return maxIntermediate.toString(2).length;
}

function focusByName(name: string) {
    const element = document.getElementsByName(name)[0];
    if (element) {
        element.focus();
    }
}

export function ConversionConstantsSearch() {
    const [problem, setProblem] = useState<ProblemLike>({
        rounding: "round",
        t: 255,
        d: 31,
        inputRange: 31,
    });

    const [solve, setSolve] = useState<SolveFn>(() => dummySolve);

    useEffect(() => {
        init_gma().then(() => {
            setSolve(() => wasmSolve);
        });
    }, []);

    const [result, setResult] = useState<Result>(dummyResult);
    useEffect(() => {
        const result = solve(problem);
        setResult(result);
        setHasMoreSolutions(result.hasMoreSolutions);
    }, [solve, problem]);
    const [hasMoreSolutions, setHasMoreSolutions] = useState(true);
    const searchMore = useCallback(() => {
        const startTime = performance.now();
        const [moreSolutions, done] = result.getMoreSolutions();
        const time = performance.now() - startTime;

        if (done || moreSolutions.length === 0) {
            setHasMoreSolutions(false);
        }
        setResult((r) => {
            return { ...r, solutions: [...r.solutions, ...moreSolutions], time: r.time + time };
        });
    }, [result]);

    return (
        <>
            <ProblemInput problem={problem} setProblem={setProblem} />
            <SolutionOutput best={result.bestSolution} addZero={result.addZero} />
            <ConversionCode problem={result.problem} solution={result.bestSolution} />
            <AllSolutions result={result} searchMore={hasMoreSolutions ? searchMore : undefined} />
        </>
    );
}

interface InputConstraints {
    maxT: number;
    maxD: number;
    maxInputRange: number;
}
const defaultConstraints: InputConstraints = {
    maxT: 2 ** 32 - 1,
    maxD: 2 ** 32 - 1,
    maxInputRange: 2 ** 32 - 1,
};
interface ProblemInputProps {
    problem: ProblemLike;
    setProblem: (value: React.SetStateAction<ProblemLike>) => void;
    constraints?: Readonly<Partial<InputConstraints>>;
}
export const ProblemInput = memo(({ problem, setProblem, constraints }: ProblemInputProps) => {
    const { inputRange, d: denominator, t: enumerator, rounding } = problem;
    const {
        maxD = defaultConstraints.maxD,
        maxT = defaultConstraints.maxT,
        maxInputRange = defaultConstraints.maxInputRange,
    } = constraints || defaultConstraints;

    const setInputRange = (value: number) => setProblem((p) => ({ ...p, inputRange: value }));
    const setDenominator = (value: number) => setProblem((p) => ({ ...p, d: value }));
    const setEnumerator = (value: number) => setProblem((p) => ({ ...p, t: value }));
    const setRounding = (value: ProblemLike["rounding"]) =>
        setProblem((p) => ({ ...p, rounding: value }));

    return (
        <>
            <div className="narrow">
                <div className="mb-1 flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="rounding"
                    >
                        Rounding <span className="border-b-2 border-yellow-500">(R)</span>
                    </label>
                    <DownDown
                        name="rounding"
                        value={rounding}
                        onChange={setRounding}
                        className="xs:max-w-40 w-full"
                        options={["round", "floor", "ceil"]}
                    />
                </div>
                <div className="mb-1 flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="enumerator"
                    >
                        Enumerator <span className="border-b-2 border-emerald-400">(T)</span>
                    </label>
                    <NumberInput
                        name="enumerator"
                        min={1}
                        max={maxT}
                        className="xs:max-w-40 w-full min-w-0"
                        value={enumerator}
                        onChange={setEnumerator}
                    />
                </div>
                <div className="mb-1 flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="denominator"
                    >
                        Denominator <span className="border-b-2 border-red-600">(D)</span>
                    </label>
                    <NumberInput
                        name="denominator"
                        min={1}
                        max={maxD}
                        className="xs:max-w-40 w-full min-w-0"
                        value={denominator}
                        onChange={setDenominator}
                    />
                </div>
                <div className="flex">
                    <label
                        className="mr-2 inline-block w-32 shrink-0 text-right leading-8"
                        htmlFor="inputRange"
                    >
                        Input range <span className="border-b-2 border-slate-500">(U)</span>
                    </label>
                    <div className="flex w-full flex-row flex-wrap gap-x-2 gap-y-1">
                        <NumberInput
                            name="inputRange"
                            min={1}
                            max={maxInputRange}
                            value={inputRange}
                            className="xs:max-w-40 w-full min-w-0"
                            onChange={setInputRange}
                        />
                        <span className="flex flex-wrap gap-1">
                            {maxInputRange >= 2 ** 8 - 1 && (
                                <UButton
                                    inputRange={inputRange}
                                    setInputRange={setInputRange}
                                    bits={8}
                                />
                            )}
                            {maxInputRange >= 2 ** 16 - 1 && (
                                <UButton
                                    inputRange={inputRange}
                                    setInputRange={setInputRange}
                                    bits={16}
                                />
                            )}
                            {maxInputRange >= 2 ** 24 - 1 && (
                                <UButton
                                    inputRange={inputRange}
                                    setInputRange={setInputRange}
                                    bits={24}
                                />
                            )}
                            {maxInputRange >= 2 ** 32 - 1 && (
                                <UButton
                                    inputRange={inputRange}
                                    setInputRange={setInputRange}
                                    bits={32}
                                />
                            )}
                        </span>
                    </div>
                </div>
            </div>

            <div className="narrow xs:flex mt-4">
                <div className="xs:inline-block xs:w-32 xs:text-right mr-2 shrink-0 text-center leading-7">
                    The Problem:
                </div>
                <div className="xs:text-left text-center font-serif text-lg">
                    <span
                        className="border-b-2 border-yellow-500 pb-1"
                        onClick={() => focusByName("rounding")}
                    >
                        {rounding}
                    </span>
                    (<em>x</em> •{" "}
                    <span
                        className="border-b-2 border-emerald-400 pb-1"
                        onClick={() => focusByName("enumerator")}
                    >
                        {enumerator}
                    </span>{" "}
                    /{" "}
                    <span
                        className="border-b-2 border-red-600 pb-1"
                        onClick={() => focusByName("denominator")}
                    >
                        {denominator}
                    </span>
                    ){" "}
                    <span className="whitespace-nowrap">
                        for <em>x</em> in 0..=
                        <span
                            className="border-b-2 border-slate-500 pb-1"
                            onClick={() => focusByName("inputRange")}
                        >
                            {inputRange}
                        </span>
                    </span>
                </div>
            </div>
        </>
    );
});

interface SolutionOutputProps {
    best: SolutionLike;
    addZero?: SolutionLike;
}
const SolutionOutput = memo(({ best, addZero }: SolutionOutputProps) => {
    let expression = <em>x</em>;

    if (best.factor !== 1n) {
        expression = (
            <>
                {expression} • {String(best.factor)}
            </>
        );
    }
    if (best.add !== 0n) {
        expression = (
            <>
                {expression} + {String(best.add)}
            </>
        );
    }
    if (best.shift > 0) {
        const shift = <span className="whitespace-nowrap">&gt;&gt; {best.shift}</span>;
        expression =
            best.add === 0n ? (
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
            <div className="narrow xs:flex mt-8">
                <div className="xs:inline-block xs:w-32 xs:text-right mr-2 shrink-0 text-center leading-6">
                    Best Solution:
                </div>
                <div className="xs:text-left text-center font-serif text-lg leading-6">
                    {expression}
                </div>
            </div>
            <div className="narrow xs:flex mt-2">
                <div className="xs:inline-block xs:w-32 xs:text-right mr-2 shrink-0 text-center leading-6">
                    Zero Solution:
                </div>
                <div className="xs:text-left text-center font-serif text-lg leading-6">
                    {addZero ? (
                        <>
                            <em>s</em>={String(addZero.shift)}
                            <span className="inline-block w-2" /> <em>f</em>=
                            {String(addZero.factor)}
                            <span className="inline-block w-2" /> <em>a</em>={String(addZero.add)}
                        </>
                    ) : (
                        <>
                            no solutions with <em>a</em>=0 exist
                        </>
                    )}
                </div>
            </div>
        </>
    );
});

interface UButtonProps {
    inputRange: number;
    setInputRange: (value: number) => void;
    bits: number;
}
const UButton = memo(({ inputRange, setInputRange, bits }: UButtonProps) => {
    return (
        <SmallButton
            selected={inputRange === 2 ** bits - 1}
            onClick={() => setInputRange(2 ** bits - 1)}
            title={`Set input range to 2^${bits} - 1`}
        >
            u{bits}
        </SmallButton>
    );
});

interface MoreSolutionsProps {
    result: Result;
    searchMore?: () => void;
}
const AllSolutions = memo(({ result, searchMore }: MoreSolutionsProps) => {
    // showing more solution will make the page longer and likely require scrolling
    // a scrollbar popping in and out of existence is annoying, so we force it to always be visible
    useEffect(() => {
        document.body.style.overflowY = "scroll";
        return () => {
            document.body.style.overflowY = "auto";
        };
    });

    const formatDuration = (time: number) => {
        if (time < 0.1) {
            return "<0.1ms";
        }
        if (time < 10) {
            return time.toFixed(1) + "ms";
        }
        return time.toFixed(0) + "ms";
    };

    const shifts = Array.from(groupBy(result.solutions, (s) => s.shift));

    return (
        <div className="narrow my-8">
            <details>
                <summary className="w-fit cursor-pointer select-none rounded-md border-2 border-zinc-700 bg-black px-4 py-2 text-neutral-200 transition-colors hover:border-zinc-500 active:bg-slate-800 [&:not(:read-only)]:hover:text-white">
                    All solutions ({searchMore ? "≥" : ""}
                    {result.solutions.length})
                </summary>

                <div className="my-4">
                    Found {result.solutions.length} solution{result.solutions.length !== 1 && "s"}{" "}
                    in {formatDuration(result.time)}.
                </div>

                <div className="my-4">
                    {shifts.map(([shift, solutions]) => {
                        const maxFactorLen = maxLen(solutions.map((s) => s.factor));
                        const content = solutions
                            .map((s) => formatSolution(s, maxFactorLen))
                            .join("\n");

                        return (
                            <pre
                                key={shift}
                                className="-mx-4 mb-4 overflow-auto whitespace-pre px-4 font-mono text-sm sm:mx-0 sm:px-0"
                            >
                                {content}
                            </pre>
                        );
                    })}
                </div>

                {searchMore ? <button onClick={searchMore}>Show more solution</button> : undefined}
            </details>
        </div>
    );
});

function maxLen(array: readonly unknown[]): number {
    return Math.max(...array.map((a) => String(a).length));
}
function formatAdd(add: AddRangeLike): string {
    return add.min === add.max ? String(add.min) : add.min + "..=" + add.max;
}
function formatSolution(s: SolutionRangeLike, maxFactorLen: number = 0): string {
    return `s=${s.shift} f=${String(s.factor).padEnd(maxFactorLen)} a=${formatAdd(s.add)}`;
}
