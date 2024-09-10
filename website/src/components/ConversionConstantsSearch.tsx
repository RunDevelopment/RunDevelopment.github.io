"use client";

import { lazy } from "../lib/util";
import { useEffect, useMemo, useState } from "react";
import { CodeBlock } from "./md/CodeBlock";
import {
    Conversion,
    ConversionRange,
    Request,
    RoundingFunction,
    bruteForceAllSolutions,
} from "../lib/components/multiply-add-constants";

interface SolutionRequirements {
    optimizeAdd: boolean;
}

async function bruteForceSolution(
    request: Request,
    requirements: SolutionRequirements,
    signal: AbortSignal,
): Promise<Conversion | null> {
    const pickAny = (range: ConversionRange): Conversion => {
        const {
            factor,
            add: [addMin, addMax],
            shift,
        } = range;
        if (addMin === 0) {
            return { factor, add: 0, shift };
        }
        if (addMin <= factor && factor <= addMax) {
            return { factor, add: factor, shift };
        }
        if (addMax === 2 ** shift - 1) {
            return { factor, add: addMax, shift };
        }
        return { factor, add: addMin, shift };
    };

    if (!requirements.optimizeAdd) {
        // any solution will do
        for await (const solution of bruteForceAllSolutions(request, {}, signal)) {
            return pickAny(solution);
        }
        return null;
    }

    let any: Conversion | null = null;
    let factorAdd: Conversion | null = null;
    for await (const solution of bruteForceAllSolutions(
        request,
        { maxShiftAfterFirstSolution: 6 },
        signal,
    )) {
        any ??= pickAny(solution);
        if (solution.add[0] === 0) {
            return pickAny(solution);
        }
        if (factorAdd === null) {
            if (solution.add[0] <= solution.factor && solution.factor <= solution.add[1]) {
                factorAdd = {
                    factor: solution.factor,
                    add: solution.factor,
                    shift: solution.shift,
                };
            }
        }
    }

    return factorAdd ?? any;
}

const webWorkerBruteForce = lazy(() => {
    let lastAbort: AbortController | null = null;
    let lastPromise: Promise<unknown> = Promise.resolve();
    const onmessage = (e: MessageEvent) => {
        const { id, request, requirements } = e.data;
        const process = async () => {
            try {
                lastAbort?.abort("Took too long");
                await lastPromise;
                const abort = new AbortController();
                lastAbort = abort;

                const start = Date.now();
                const promise = bruteForceSolution(request, requirements, abort.signal);
                lastPromise = promise.catch(() => {});
                const conversion = await promise;
                const time = Date.now() - start;
                postMessage({ id, conversion, request, time });
            } catch (e) {
                postMessage({ id, error: String(e) });
            }
        };
        process().catch(console.error);
    };

    const worker = new Worker(
        URL.createObjectURL(
            new Blob(
                [
                    bruteForceAllSolutions.toString() +
                        bruteForceSolution.toString() +
                        "\nlet lastAbort = null;" +
                        "\nlet lastPromise = Promise.resolve();" +
                        "\nonmessage = " +
                        onmessage.toString(),
                ],
                {
                    type: "application/javascript",
                },
            ),
        ),
    );

    let idCounter = 0;
    const listeners = new Map<number, (result: unknown) => void>();

    worker.onmessage = (e) => {
        const { id } = e.data;
        const listener = listeners.get(id);
        if (listener) {
            listener(e.data);
            listeners.delete(id);
        }
    };

    return (request: Request, requirements: SolutionRequirements) => {
        const id = idCounter++;
        worker.postMessage({ id, request, requirements });
        return new Promise<BruteForceResult>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            listeners.set(id, (result: any) => {
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve({
                        conversion: result.conversion,
                        time: result.time,
                        request: request,
                    });
                }
            });
        });
    };
});

interface BruteForceResult {
    conversion: Conversion | null;
    request: Request;
    time: number;
}

async function bruteForce(
    request: Request,
    requirements: SolutionRequirements,
): Promise<BruteForceResult> {
    if (typeof Worker !== "undefined") {
        return webWorkerBruteForce()(request, requirements);
    }
    const start = Date.now();
    const abort = new AbortController();
    const conversion = await bruteForceSolution(request, requirements, abort.signal);
    const time = Date.now() - start;
    return { conversion, time, request };
}

interface NumberInputProps {
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    readOnly?: boolean;
    className?: string;
}
function NumberInput({ value, onChange, min, max, readOnly, className }: NumberInputProps) {
    const [text, setText] = useState(value.toString());

    useEffect(() => {
        setText(value.toString());
    }, [value]);

    const commit = (): void => {
        const newValue = parseInt(text, 10);
        if (Number.isNaN(newValue)) {
            // reset
            setText(value.toString());
        } else {
            const clamped = Math.min(Math.max(newValue, min), max);
            onChange(clamped);
            setText(clamped.toString());
        }
    };

    return (
        <input
            type="number"
            className={"read-only:text-neutral-500 " + (className || "")}
            min={min}
            readOnly={readOnly}
            max={max}
            value={text}
            onChange={(e) => {
                setText(e.target.value);

                const number = parseInt(e.target.value, 10);
                if (String(number) === e.target.value && number >= min && number <= max) {
                    onChange(number);
                }
            }}
            onKeyDown={(e) => {
                if (e.key === "Enter") {
                    commit();
                }
            }}
            onBlur={commit}
        />
    );
}

interface DowndownProps<T extends string> {
    value: T;
    onChange: (value: T) => void;
    options: readonly T[];
    getLabel?: (value: T) => string;
    className?: string;
}
function Downdown<T extends string>({
    value,
    onChange,
    options,
    getLabel,
    className,
}: DowndownProps<T>) {
    return (
        <select className={className} value={value} onChange={(e) => onChange(e.target.value as T)}>
            {options.map((option) => (
                <option key={option} value={option}>
                    {getLabel?.(option) ?? option}
                </option>
            ))}
        </select>
    );
}

export function ConversionConstantsSearch() {
    const [inputRange, setInputRange] = useState(31);
    const [from, setFrom] = useState(31);
    const [to, setTo] = useState(255);
    const [round, setRound] = useState<RoundingFunction>("round");
    const [linkedInputRange, setLinkedInputRange] = useState(true);
    const [optimizeAdd, setOptimizeAdd] = useState(false);

    useEffect(() => {
        if (linkedInputRange) {
            setFrom(inputRange);
        }
    }, [linkedInputRange, inputRange]);

    const [result, setResult] = useState<BruteForceResult>({
        conversion: { factor: 527, add: 23, shift: 6 },
        request: { inputRange, R: round, D: from, T: to },
        time: 0,
    });
    useEffect(() => {
        bruteForce(
            { inputRange, R: round, D: from, T: to },
            { optimizeAdd: optimizeAdd && round === "floor" },
        ).then(setResult, (e) => console.error(e));
    }, [inputRange, from, to, round, optimizeAdd]);

    interface ResultContent {
        text: string;
        rustCode?: string;
        cCode?: string;
    }
    const resultContent = useMemo((): ResultContent => {
        if (!result.conversion) {
            return { text: "Result: nothing found." };
        }

        const { factor, add, shift } = result.conversion;
        const inputRange = result.request.inputRange;
        const outputRange = Math.floor((factor * inputRange + add) / 2 ** shift);

        const bitsToTypeSize = (bits: number) => {
            if (bits <= 8) {
                return 8;
            } else if (bits <= 16) {
                return 16;
            } else if (bits <= 32) {
                return 32;
            } else if (bits <= 64) {
                return 64;
            } else {
                return 128;
            }
        };

        const fromType = bitsToTypeSize(Math.log2(inputRange + 1));
        const toType = bitsToTypeSize(Math.log2(outputRange + 1));

        let formula, rustExpr, cExpr;
        if (add === 0 && shift === 0) {
            formula = `x * ${factor}`;

            rustExpr = fromType < toType ? `x as u${toType}` : `x`;
            rustExpr += factor === 1 ? `` : ` * ${factor}`;

            cExpr = fromType < toType ? `(uint${toType}_t)x` : `x`;
            cExpr += factor === 1 ? `` : ` * ${factor}`;
        } else {
            const maxIntermediate = inputRange * factor + add;
            const interBits = Math.ceil(Math.log2(maxIntermediate));
            formula = `(x * ${factor} + ${add}) >> ${shift}  (${interBits} bits required)`;

            const interType = bitsToTypeSize(interBits);

            rustExpr = fromType < interType ? `x as u${interType}` : `x`;
            rustExpr += factor === 1 ? `` : ` * ${factor}`;
            rustExpr += add === 0 ? `` : ` + ${add}`;
            rustExpr = `(${rustExpr}) >> ${shift}`;
            if (interType > toType) {
                rustExpr = `(${rustExpr}) as u${toType}`;
            }

            cExpr = fromType < interType ? `(uint${interType}_t)x` : `x`;
            cExpr += factor === 1 ? `` : ` * ${factor}`;
            cExpr += add === 0 ? `` : ` + ${add}`;
            cExpr = `(${cExpr}) >> ${shift}`;
        }

        const text = [
            `Result: ${formula}`,
            `        f: ${factor}, a: ${add}, s: ${shift}`,
            `        search took ${result.time}ms`,
        ].join("\n");

        const roundingComment: Record<RoundingFunction, string> = {
            round: "rounding",
            floor: "rounding down",
            ceil: "rounding up",
        };
        const comment1 = `Converts a value 0..=${inputRange} to 0..=${outputRange}`;
        const comment2 = `by multiplying with ${result.request.T}/${result.request.D} and then ${roundingComment[result.request.R]}.`;
        const needsAssert = inputRange !== 2 ** fromType - 1;

        const rustCode = [
            `/// ${comment1}`,
            `/// ${comment2}`,
            `fn convert_range(x: u${fromType}) -> u${toType} {`,
            needsAssert ? `    debug_assert!(x <= ${inputRange});` : "",
            `    ${rustExpr}`,
            `}`,
        ]
            .filter(Boolean)
            .join("\n");

        const cCode = [
            `// ${comment1}`,
            `// ${comment2}`,
            `uint${toType}_t convert_range(uint${fromType}_t x) {`,
            needsAssert ? `    assert(x <= ${inputRange});` : "",
            `    return ${cExpr};`,
            `}`,
        ]
            .filter(Boolean)
            .join("\n");

        return { text, rustCode, cCode };
    }, [result]);

    return (
        <>
            <pre className="whitespace-pre-wrap">
                <div>
                    {">>> (U) Input range:  0 - "}
                    <NumberInput
                        className="bg-black"
                        min={1}
                        max={4294967296}
                        value={inputRange}
                        onChange={(value) => {
                            setInputRange(value);
                            if (linkedInputRange) {
                                setFrom(value);
                            }
                        }}
                    />
                </div>
                <div>
                    {">>>                       "}
                    <label>
                        <input
                            type="checkbox"
                            checked={linkedInputRange}
                            onChange={(e) => {
                                setLinkedInputRange(e.target.checked);
                            }}
                        />{" "}
                        linked
                    </label>
                </div>
                <div>
                    {">>> (D) Divisor:      0 - "}
                    <NumberInput
                        className="bg-black"
                        min={1}
                        max={4294967296}
                        value={from}
                        readOnly={linkedInputRange}
                        onChange={setFrom}
                    />
                </div>
                <div>
                    {">>> (T) Denominator:  0 - "}
                    <NumberInput
                        className="bg-black"
                        min={1}
                        max={4294967296}
                        value={to}
                        onChange={setTo}
                    />
                </div>
                <div>
                    {">>> (R) Rounding Fn:  "}
                    <Downdown
                        className="bg-black"
                        value={round}
                        onChange={setRound}
                        options={["round", "floor", "ceil"]}
                        getLabel={(value) => value}
                    />
                </div>
                {round === "floor" && (
                    <div>
                        <label>
                            {">>> "}
                            <span className="inline-flex w-[calc(3*0.6em)] flex-col items-center">
                                <input
                                    type="checkbox"
                                    checked={optimizeAdd}
                                    onChange={(e) => {
                                        setOptimizeAdd(e.target.checked);
                                    }}
                                />
                            </span>{" "}
                            Optimize a
                        </label>
                    </div>
                )}
                {"\n" + resultContent.text}
            </pre>
            {resultContent.rustCode && <CodeBlock code={resultContent.rustCode} lang="rust" />}
            {resultContent.cCode && <CodeBlock code={resultContent.cCode} lang="c" />}
        </>
    );
}
