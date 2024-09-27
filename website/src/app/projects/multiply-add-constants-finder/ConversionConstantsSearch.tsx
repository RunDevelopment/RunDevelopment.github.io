"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { NumberInput, DownDown, SmallButton } from "../../../components/FormInputs";
import init_gma, { Problem, Constraints } from "@rundevelopment/gma_wasm";
import { ConversionCode } from "../../../components/multiply-add/CodeGen";
import {
    AddRangeLike,
    ProblemLike,
    SolutionLike,
    SolutionRangeLike,
} from "../../../components/multiply-add/interfaces";
import { groupBy } from "../../../lib/util";

interface Result {
    problem: ProblemLike;
    solution: SolutionLike;
    addZero: SolutionLike | undefined;
    solutions: SolutionRangeLike[];
    time: number;
}
interface SolveOptions {
    shiftsAfterFirstSolution?: number;
}
type SolveFn = (problem: ProblemLike, options?: SolveOptions) => Result;

const dummyResult: Result = {
    problem: { rounding: "round", t: 255, d: 31, inputRange: 31 },
    solution: { factor: 527n, add: 23n, shift: 6 },
    addZero: undefined,
    solutions: [{ factor: 527n, add: { min: 23n, max: 23n }, shift: 6 }],
    time: 0,
};
const dummySolve: SolveFn = (problem) => {
    return { ...dummyResult, problem };
};
const wasmSolve: SolveFn = (p, options) => {
    const start = performance.now();

    const problem = new Problem(p.rounding, p.t, p.d, p.inputRange);
    const addZero = problem.getSmallestAddZeroSolution();

    const constraints = new Constraints();
    constraints.shiftsAfterFirstSolution = options?.shiftsAfterFirstSolution ?? 2;
    const iter = problem.getSolutionRanges();
    const solution = iter.next()!;
    const solutions = [solution];

    const MAX_SOLUTIONS = 50;
    const MAX_ITER_TIME = 10; // ms
    const FIRST_MAX_TIME = 30; // ms

    const iterStart = performance.now();
    let time = iterStart - start;
    // only iterate solution if the first solution was found quickly
    if (time < FIRST_MAX_TIME) {
        time = 0;
        let s;
        // iterate all solution until we take too long OR we have enough solutions
        while (time < MAX_ITER_TIME && (s = iter.next())) {
            solutions.push(s);

            if (solutions.length >= MAX_SOLUTIONS) {
                break;
            }
            time = performance.now() - iterStart;
        }

        if (time < MAX_ITER_TIME / 2) {
            // we still have a lot of time left, so let's get all solutions for
            // the last shift to finish it and then stop
            const shift = solutions[solutions.length - 1].shift;
            while ((s = iter.next())) {
                if (s.shift !== shift) {
                    break;
                }
                solutions.push(s);
            }
        }
    }

    time = performance.now() - start;

    return {
        problem,
        solution: solution.pickAny(),
        solutions,
        addZero,
        time,
    };
};

export function ConversionConstantsSearch() {
    const [inputRange, setInputRange] = useState(31);
    const [denominator, setDenominator] = useState(31);
    const [enumerator, setEnumerator] = useState(255);
    const [round, setRound] = useState<ProblemLike["rounding"]>("round");

    const [solve, setSolve] = useState<SolveFn>(() => dummySolve);

    useEffect(() => {
        init_gma().then(() => {
            setSolve(() => wasmSolve);
        });
    }, []);

    const [result, setResult] = useState<Result>(dummyResult);
    useEffect(() => {
        const result = solve({ inputRange, rounding: round, t: enumerator, d: denominator });
        setResult(result);
    }, [solve, inputRange, denominator, enumerator, round]);

    interface ResultContent {
        text: string;
        rustCode?: string;
        cCode?: string;
    }
    const resultContent = useMemo((): ResultContent => {
        const { factor, add, shift } = result.solution;
        const inputRange = result.problem.inputRange;

        let formula;
        if (add === 0n && shift === 0) {
            formula = `x * ${factor}`;
        } else {
            const maxIntermediate = BigInt(inputRange) * factor + add;
            const interBits = maxIntermediate.toString(2).length;
            formula = `(x * ${factor} + ${add}) >> ${shift}  (${interBits} bits required)`;
        }

        result.solutions.sort((a, b) => {
            if (a.shift !== b.shift) return a.shift - b.shift;
            return Number(a.factor - b.factor);
        });

        const text = [
            `Result: ${formula}`,
            `        f=${factor}, a=${add}, s=${shift}`,
            `  Zero: ` +
                (result.addZero
                    ? `f=${result.addZero.factor}, a=0, s=${result.addZero.shift}`
                    : "none"),
            `        search took ${result.time.toFixed(1)}ms`,
        ].join("\n");

        return { text };
    }, [result]);

    const MAX = 2 ** 32 - 1;

    return (
        <>
            <div className="narrow">
                <div className="mb-1">
                    <span className="mr-2 inline-block w-32 text-right">
                        Rounding <span className="border-b-2 border-yellow-500">(R)</span>
                    </span>
                    <DownDown
                        value={round}
                        onChange={setRound}
                        className="w-40"
                        options={["round", "floor", "ceil"]}
                    />
                </div>
                <div className="mb-1">
                    <span className="mr-2 inline-block w-32 text-right">
                        Enumerator <span className="border-b-2 border-emerald-400">(T)</span>
                    </span>
                    <NumberInput
                        min={1}
                        max={MAX}
                        className="w-40"
                        value={enumerator}
                        onChange={setEnumerator}
                    />
                </div>
                <div className="mb-1">
                    <span className="mr-2 inline-block w-32 text-right">
                        Denominator <span className="border-b-2 border-red-600">(D)</span>
                    </span>
                    <NumberInput
                        min={1}
                        max={MAX}
                        className="w-40"
                        value={denominator}
                        onChange={setDenominator}
                    />
                </div>
                <div className="mb-1">
                    <span className="mr-2 inline-block w-32 text-right">
                        Input range <span className="border-b-2 border-slate-500">(U)</span>
                    </span>
                    <NumberInput
                        min={1}
                        max={MAX}
                        value={inputRange}
                        className="w-40"
                        onChange={(value) => {
                            setInputRange(value);
                        }}
                    />
                    <span className="ml-2 inline-flex gap-1">
                        <UButton inputRange={inputRange} setInputRange={setInputRange} bits={8} />
                        <UButton inputRange={inputRange} setInputRange={setInputRange} bits={16} />
                        <UButton inputRange={inputRange} setInputRange={setInputRange} bits={32} />
                    </span>
                </div>
            </div>

            <div className="narrow">
                <span>The problem: </span>
                <span className="font-serif text-lg">
                    <span className="border-b-2 border-yellow-500 pb-1">{round}</span>(<em>x</em> *{" "}
                    <span className="border-b-2 border-emerald-400 pb-1">{enumerator}</span> /{" "}
                    <span className="border-b-2 border-red-600 pb-1">{denominator}</span>){" "}
                    <span className="whitespace-nowrap">
                        for <em>x</em> in 0..=
                        <span className="border-b-2 border-slate-500 pb-1">{inputRange}</span>
                    </span>
                </span>
            </div>

            <pre className="narrow whitespace-pre-wrap">{"\n" + resultContent.text}</pre>
            <ConversionCode problem={result.problem} solution={result.solution} />
            <MoreSolutions result={result} />
        </>
    );
}

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
        >
            u{bits}
        </SmallButton>
    );
});

interface MoreSolutionsProps {
    result: Result;
}
const MoreSolutions = memo(({ result }: MoreSolutionsProps) => {
    if (result.solutions.length <= 1) {
        return (
            <div className="narrow">
                <p>No more solutions found within time limit.</p>
            </div>
        );
    }

    const shifts = Array.from(groupBy(result.solutions, (s) => s.shift));

    return (
        <div className="narrow my-8">
            <details>
                <summary className="w-fit cursor-pointer rounded-md border-2 border-zinc-700 bg-black px-4 py-2 text-neutral-200 transition-colors hover:border-zinc-500 active:bg-slate-800 [&:not(:read-only)]:hover:text-white">
                    More solutions ({result.solutions.length - 1})
                </summary>

                <div className="my-4">
                    {shifts.map(([shift, solutions]) => {
                        const maxFactorLen = maxLen(solutions.map((s) => s.factor));
                        const maxAddLen = maxLen(solutions.map((s) => formatAdd(s.add)));

                        return (
                            <div key={shift} className="mb-4">
                                {/* <p>s={shift}</p> */}
                                {/* <p>Shift {shift}:</p> */}
                                <pre className="whitespace-pre-wrap font-mono">
                                    {solutions.map((s, i) => {
                                        return (
                                            <span key={i} className="pl-8 -indent-8">
                                                <FormatSolution
                                                    solution={s}
                                                    maxFactorLen={maxFactorLen}
                                                    maxAddLen={maxAddLen}
                                                />
                                            </span>
                                        );
                                    })}
                                </pre>
                            </div>
                        );
                    })}
                </div>
            </details>
        </div>
    );
});

const maxLen = (array: readonly unknown[]): number => {
    return Math.max(...array.map((a) => String(a).length));
};
const formatAdd = (add: AddRangeLike): string => {
    return add.min === add.max ? String(add.min) : add.min + "..=" + add.max;
};

interface FormatSolutionProps {
    solution: SolutionRangeLike;
    maxFactorLen?: number;
    maxAddLen?: number;
}
function FormatSolution({ solution: s, maxFactorLen = 0, maxAddLen = 0 }: FormatSolutionProps) {
    const add = s.add;
    const addFormat =
        add.min === add.max ? (
            String(add.min)
        ) : (
            <>
                {String(add.min)}
                <wbr />
                {"..=" + add.max}
            </>
        );

    return (
        <>
            f={String(s.factor).padEnd(maxFactorLen)}, a=
            {addFormat},<wbr />
            {maxAddLen > 0 && "".padEnd(maxAddLen - formatAdd(add).length)} s={s.shift}
            {"\n"}
        </>
    );
}
