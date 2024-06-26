import { lazy } from "@/lib/util";
import { useEffect, useMemo, useState } from "react";
import { CodeBlock } from "./CodeBlock";

type RoundingFunction = "round" | "floor" | "ceil";
interface Request {
    inputRange: number;
    R: RoundingFunction;
    D: number;
    T: number;
}
interface SearchOptions {
    /**
     * The max number of shift that will be checked after the first solution has been found.
     *
     * @default 0
     */
    maxShiftAfterFirstSolution?: number;
    /**
     * Only the solution with the smallest add value will be returned for a solution for a given factor and shift.
     *
     * @default false
     */
    onlySmallestAdd?: boolean;
    /**
     * If true, then only solutions with off factors (if shift > 0) will be returned.
     *
     * @default false
     */
    onlyMinimalSolutions?: boolean;
    /**
     * @default 64
     */
    maxShift?: number;
}
interface SolutionRequirements {
    optimizeAdd: boolean;
}
interface Conversion {
    factor: number;
    add: number;
    shift: number;
}
interface ConversionRange {
    factor: number;
    add: [min: number, max: number];
    shift: number;
}

async function* bruteForceAllSolutions(
    { inputRange, R, D, T }: Request,
    {
        maxShiftAfterFirstSolution = 0,
        onlySmallestAdd = false,
        onlyMinimalSolutions = false,
        maxShift = 64,
    }: SearchOptions,
    signal: AbortSignal,
): AsyncIterable<ConversionRange> {
    const debug = 2;

    const getActual = (i: number, { factor, shift, add }: Conversion) => {
        // use bigint, because bit-shift is 32-bit only
        return Number((BigInt(i) * BigInt(factor) + BigInt(add)) >> BigInt(shift));
    };
    function getRoundingFunction(): (x: number) => number {
        switch (R) {
            case "round":
                return Math.round;
            case "floor":
                return Math.floor;
            case "ceil":
                return Math.ceil;
        }
    }
    function yieldThread() {
        return new Promise<void>((resolve) => {
            setTimeout(resolve, 0);
        });
    }

    // make everything more efficient by reducing the fraction
    function gcd(a: number, b: number): number {
        return b === 0 ? a : gcd(b, a % b);
    }
    const g = gcd(T, D);
    T /= g;
    D /= g;

    const round = getRoundingFunction();
    const getExpected = (x: number) => round((x * T) / D);
    const outputRange = getExpected(inputRange);

    const createCheck1 = () => {
        // pre-compute all expected values
        const expectedArray: number[] = [];
        for (let x = 0; x <= inputRange; x++) {
            expectedArray.push(getExpected(x));
        }

        // values that are very likely to be rejected
        const rejectTestValues = new Set<number>([0, 1, inputRange - 1, inputRange]);

        let lastRejected: number | null = null;
        let rejectedCount = 0;
        const exhaustiveTest = (conversion: Conversion) => {
            // exhaustive test

            // quick check for last rejected
            if (lastRejected !== null) {
                if (getActual(lastRejected, conversion) !== expectedArray[lastRejected]) {
                    return false;
                }
            }

            // use slow bigint version only if necessary
            if (inputRange * conversion.factor + conversion.add < Number.MAX_SAFE_INTEGER) {
                // slower with floor division
                const { factor, add, shift } = conversion;
                const div = 2 ** shift;

                // start with values that were rejected before
                for (const x of rejectTestValues) {
                    if (Math.floor((x * factor + add) / div) !== expectedArray[x]) {
                        return false;
                    }
                }

                // test all values
                for (let x = 0; x <= inputRange; x++) {
                    if (Math.floor((x * factor + add) / div) !== expectedArray[x]) {
                        if (debug >= 2 && x !== lastRejected) {
                            if (rejectedCount > 0) {
                                console.log(
                                    `Rejected for ${lastRejected} a total of ${rejectedCount} times`,
                                );
                            }
                            rejectedCount = 1;
                        } else {
                            rejectedCount++;
                        }

                        rejectTestValues.add(x);
                        lastRejected = x;
                        return false;
                    }
                }
                return true;
            } else {
                // slowest bigint

                // start with values that were rejected before
                for (const x of rejectTestValues) {
                    if (getActual(x, conversion) !== expectedArray[x]) {
                        return false;
                    }
                }

                // test all values
                for (let x = 0; x <= inputRange; x++) {
                    if (getActual(x, conversion) !== expectedArray[x]) {
                        if (debug >= 2 && x !== lastRejected) {
                            if (rejectedCount > 0) {
                                console.log(
                                    `Rejected for ${lastRejected} a total of ${rejectedCount} times`,
                                );
                            }
                            rejectedCount = 1;
                        } else {
                            rejectedCount++;
                        }

                        rejectTestValues.add(x);
                        lastRejected = x;
                        return false;
                    }
                }
            }
            return true;
        };

        return function* checkFactor(factor: number, shift: number): Iterable<ConversionRange> {
            const shiftAbs = 2 ** shift;
            let addMin = 0;
            let addMax = shiftAbs - 1;

            // narrow add range
            const incStart = Math.floor(shiftAbs / 2) + 1;
            const kValues = Array.from(rejectTestValues);
            kValues.sort((a, b) => a - b);

            let minSteps = 0;
            for (let inc = incStart; inc > 0 && addMin <= addMax; inc = Math.floor(inc / 2)) {
                for (const k of kValues) {
                    while (
                        addMin <= addMax &&
                        getActual(k, { factor, add: addMin + inc, shift }) < expectedArray[k]
                    ) {
                        minSteps++;
                        addMin += inc;
                    }
                }
            }
            let maxSteps = 0;
            for (let dec = incStart; dec > 0 && addMax >= addMin; dec = Math.floor(dec / 2)) {
                for (const k of kValues) {
                    while (
                        addMax >= addMin &&
                        getActual(k, { factor, add: addMax - dec, shift }) > expectedArray[k]
                    ) {
                        maxSteps++;
                        addMax -= dec;
                    }
                }
            }

            if (debug >= 1) {
                console.log(`kValues=${kValues.length} minSteps=${minSteps} maxSteps=${maxSteps}`);
            }

            if (addMin > addMax) {
                // we ruled out all add values
                return;
            }

            if (debug >= 1) {
                console.log(`Exhaustive test for ${addMax - addMin + 1} add values`);
            }
            lastRejected = null;
            rejectedCount = 0;
            for (let add = addMin; add <= addMax; add++) {
                const candidate = { factor, add, shift };
                if (getActual(inputRange, candidate) === outputRange && exhaustiveTest(candidate)) {
                    yield { factor, add: [add, add], shift };
                }
            }

            if (debug >= 2 && rejectedCount > 0) {
                console.log(`Rejected for ${lastRejected} a total of ${rejectedCount} times`);
            }
        };
    };
    const createCheck2 = () => {
        return function* checkFactor(factor: number, shift: number): Iterable<ConversionRange> {
            const shiftAbs = 2 ** shift;

            let addMin = 0;
            let addMax = shiftAbs - 1;

            const narrowFor = (x: number, expected: number) => {
                //   x*f+a = 0 (mod 2^shift)
                //   a = -x*f (mod 2^shift)
                // Let b=-x*f mod 2^shift
                //   => a = b + k*2^shift, k in Z
                const b = (((-x * factor) % shiftAbs) + shiftAbs) % shiftAbs;

                if (addMin <= b && b <= addMax) {
                    // we can use b to narrow the range
                    const actual = Math.floor((x * factor + b) / shiftAbs);

                    if (actual < expected) {
                        addMin = b + shiftAbs;
                    } else if (actual > expected) {
                        addMax = b - 1;
                    } else {
                        // actual === expected
                        addMin = b;
                    }
                    console.log(`x=${x}: Narrowed range to addMin=${addMin} addMax=${addMax}`);
                } else {
                    // if any a, addMin <= a <= addMax reject, then the entire range rejects
                    // TODO: bigint
                    if (Math.floor((x * factor + addMin) / shiftAbs) !== expected) {
                        addMax = -1;
                        console.log(`x=${x}: Narrowed range to addMin=${addMin} addMax=${addMax}`);
                    }
                }
            };

            // start by narrowing with inputRange, which always seems to e highly effective
            narrowFor(inputRange, outputRange);

            // narrow add range
            const max = Math.round(Math.min(inputRange / 2, D));
            for (let i = 1; i <= max; i++) {
                narrowFor(i, getExpected(i));
                narrowFor(inputRange - i, getExpected(inputRange - i));

                if (addMin > addMax) {
                    // we ruled out all add values
                    return;
                }
            }

            console.log(`Found ${addMax - addMin + 1} add values`);
            yield { factor, add: [addMin, addMax], shift };
            return;
        };
    };

    const getClosestOffIntegers = (shift: number) => {
        const real = (T * 2 ** shift) / D;
        const closest = Math.round(real);
        if (shift === 0) {
            return [closest];
        }
        if (closest % 2 === 0) {
            const low = closest - 1;
            const high = closest + 1;
            const lowDist = Math.abs(real - low);
            const highDist = Math.abs(real - high);
            if (lowDist < highDist) {
                return [low];
            } else if (highDist < lowDist) {
                return [high];
            } else {
                return [low, high];
            }
        } else {
            return [closest];
        }
    };

    const checks = [createCheck1, createCheck2];
    const checkFactor = checks[1]();

    for (let shift = 0; shift < maxShift; shift++) {
        const shiftAbs = 2 ** shift;

        const factorsToCheck = getClosestOffIntegers(shift);
        const checkedFactors = new Set<number>();
        const addFactorToCheck = (factor: number) => {
            if (!checkedFactors.has(factor) && factor >= 0) {
                checkedFactors.add(factor);
                if (onlyMinimalSolutions && shift > 0 && factor % 2 === 0) {
                    // solutions with this factor can't be minimal
                    return;
                }
                factorsToCheck.push(factor);
            }
        };

        while (factorsToCheck.length > 0) {
            const factor = factorsToCheck.shift()!;

            if (
                getActual(inputRange, { factor, add: 0, shift }) > outputRange ||
                getActual(inputRange, { factor, add: shiftAbs - 1, shift }) < outputRange
            ) {
                // the factor is too high or too low
                continue;
            }

            await yieldThread();
            signal.throwIfAborted();

            if (debug >= 1) {
                console.log(`factor=${factor} shift=${shift}`);
            }

            const start = performance.now();

            let foundAnySolution = false;
            for (const solution of checkFactor(factor, shift)) {
                foundAnySolution = true;
                yield solution;

                if (onlySmallestAdd) {
                    break;
                }
            }
            if (foundAnySolution) {
                maxShift = Math.min(maxShift, shift + maxShiftAfterFirstSolution);
                addFactorToCheck(factor - 1);
                addFactorToCheck(factor + 1);
            }

            if (debug >= 1) {
                console.log(`Rejected factor in ${performance.now() - start}ms`);
            }
        }
    }
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
