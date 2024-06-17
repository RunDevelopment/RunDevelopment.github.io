import { lazy } from "@/lib/util";
import { useEffect, useMemo, useState } from "react";

type RoundingFunction = "round" | "floor" | "ceil";
interface Request {
    inputRange: number;
    R: RoundingFunction;
    S: number;
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
}
interface SolutionRequirements {
    optimizeFactor: boolean;
    addZero: boolean;
}
interface Conversion {
    factor: number;
    add: number;
    shift: number;
}

async function* bruteForceAllSolutions(
    { inputRange, R, S, T }: Request,
    {
        maxShiftAfterFirstSolution = 0,
        onlySmallestAdd = false,
        onlyMinimalSolutions = false,
    }: SearchOptions,
    signal: AbortSignal,
): AsyncIterable<Conversion> {
    const debug = 0;

    const getActual = (i: number, { factor, shift, add }: Conversion) => {
        // use bigint, because bit-shift is 32-bit only
        return Number((BigInt(i) * BigInt(factor) + BigInt(add)) >> BigInt(shift));
    };
    // eslint-disable-next-line no-unused-vars
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

    // pre-compute all expected values
    const expectedArray: number[] = [];
    const round = getRoundingFunction();
    for (let x = 0; x <= inputRange; x++) {
        expectedArray.push(round((x * T) / S));
    }
    const outputRange = expectedArray[inputRange];

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

    // eslint-disable-next-line no-unused-vars
    const getClosestOffIntegers = (shift: number) => {
        const real = (T * 2 ** shift) / S;
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

    let firstS = null;
    for (let shift = 0; shift < 64; shift++) {
        const shiftAbs = 2 ** shift;

        if (firstS !== null && firstS + maxShiftAfterFirstSolution > shift) {
            break;
        }

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

            await yieldThread();
            signal.throwIfAborted();

            const start = performance.now();

            let addMin = 0;
            let addMax = shiftAbs - 1;

            if (getActual(inputRange, { factor, add: addMin, shift }) > outputRange) {
                // the factor is too high
                break;
            }
            if (getActual(inputRange, { factor, add: addMax, shift }) < outputRange) {
                // the factor is too low
                continue;
            }

            if (debug >= 1) {
                console.log(`factor=${factor} shift=${shift}`);
            }

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

            if (addMin <= addMax) {
                if (debug >= 1) {
                    console.log(`Exhaustive test for ${addMax - addMin + 1} add values`);
                }
                lastRejected = null;
                rejectedCount = 0;
                let foundAnySolution = false;
                for (let add = addMin; add <= addMax; add++) {
                    const candidate = { factor, add, shift };
                    if (
                        getActual(inputRange, candidate) === outputRange &&
                        exhaustiveTest(candidate)
                    ) {
                        foundAnySolution = true;
                        yield candidate;

                        if (onlySmallestAdd) {
                            break;
                        }
                    }
                }
                if (foundAnySolution) {
                    if (firstS === null) {
                        firstS = shift;
                    }
                    addFactorToCheck(factor - 1);
                    addFactorToCheck(factor + 1);
                }

                if (debug >= 2 && rejectedCount > 0) {
                    console.log(`Rejected for ${lastRejected} a total of ${rejectedCount} times`);
                }
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
    if (!requirements.optimizeFactor && !requirements.addZero) {
        // any solution will do
        for await (const solution of bruteForceAllSolutions(request, {}, signal)) {
            return solution;
        }
        return null;
    }

    if (!requirements.optimizeFactor && requirements.addZero) {
        // just try to find a solution with add=0
        let minSolution: Conversion | null = null;
        for await (const solution of bruteForceAllSolutions(
            request,
            { maxShiftAfterFirstSolution: 12, onlySmallestAdd: true, onlyMinimalSolutions: true },
            signal,
        )) {
            if (solution.add === 0) {
                return solution;
            }
            if (minSolution === null) {
                minSolution = solution;
            }
        }
        return minSolution;
    }

    const factorCostScale = 1;
    const addCostScale = requirements.addZero ? 1 : 0;

    const getFactorCost = (factor: number) => {
        const COST_SHIFT = 1;
        const COST_LEA = 1.5;
        const COST_ADD = 2;
        const COST_MULTIPLY = 6;

        let factorsTwo = 0;
        while (factor % 2 ** (factorsTwo + 1) === 0) {
            factorsTwo++;
        }

        if (factor === 2 ** factorsTwo) {
            // factor is a power of two and can be done with a shift
            return COST_SHIFT;
        }
        if (Math.abs(factor - 2 ** factorsTwo) === 1) {
            // shift + add/sub self
            return COST_SHIFT + COST_ADD;
        }

        const rest = factor / 2 ** factorsTwo;
        if (rest === 3 || rest === 5 || rest === 9) {
            // shift + lea
            return COST_SHIFT + COST_LEA;
        }

        return COST_MULTIPLY;
    };
    const getAddCost = (add: number) => {
        const COST_ADD = 2;
        return add === 0 ? 0 : COST_ADD;
    };
    const isBetter = (a: Conversion, b: Conversion) => {
        const costA = factorCostScale * getFactorCost(a.factor) + addCostScale * getAddCost(a.add);
        const costB = factorCostScale * getFactorCost(b.factor) + addCostScale * getAddCost(b.add);
        return costA < costB;
    };

    let bestSolution: Conversion | null = null;

    for await (const solution of bruteForceAllSolutions(
        request,
        { maxShiftAfterFirstSolution: 12, onlySmallestAdd: true },
        signal,
    )) {
        if (!bestSolution) {
            bestSolution = solution;
        } else if (isBetter(solution, bestSolution)) {
            bestSolution = solution;
        }
    }

    return bestSolution;
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
    // eslint-disable-next-line no-unused-vars
    const listeners = new Map<number, (result: any) => void>();

    worker.onmessage = (e) => {
        const { id } = e.data;
        let listener = listeners.get(id);
        if (listener) {
            listener(e.data);
            listeners.delete(id);
        }
    };

    return (request: Request, requirements: SolutionRequirements) => {
        const id = idCounter++;
        worker.postMessage({ id, request, requirements });
        return new Promise<BruteForceResult>((resolve, reject) => {
            listeners.set(id, (result) => {
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
    // eslint-disable-next-line no-unused-vars
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
    // eslint-disable-next-line no-unused-vars
    onChange: (value: T) => void;
    options: readonly T[];
    // eslint-disable-next-line no-unused-vars
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

    console.log(linkedInputRange, inputRange, from);

    useEffect(() => {
        if (linkedInputRange) {
            setFrom(inputRange);
        }
    }, [linkedInputRange, inputRange]);

    const [result, setResult] = useState<BruteForceResult>({
        conversion: { factor: 527, add: 23, shift: 6 },
        request: { inputRange, R: round, S: from, T: to },
        time: 0,
    });
    useEffect(() => {
        bruteForce(
            { inputRange, R: round, S: from, T: to },
            { addZero: false, optimizeFactor: false },
        ).then(setResult, (e) => console.error(e));
    }, [inputRange, from, to, round]);

    const resultLines = useMemo(() => {
        if (!result.conversion) {
            return ["Result: nothing found."];
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
        let rustCode;

        let formula;
        if (add === 0 && shift === 0) {
            formula = `x * ${factor}`;
            rustCode = fromType < toType ? `x as u${toType}` : `x`;
            rustCode += factor === 1 ? `` : ` * ${factor}`;
        } else {
            const maxIntermediate = inputRange * factor + add;
            const interBits = Math.ceil(Math.log2(maxIntermediate));
            formula = `(x * ${factor} + ${add}) >> ${shift}  (${interBits} bits required)`;

            const interType = bitsToTypeSize(interBits);

            rustCode = fromType < interType ? `x as u${interType}` : `x`;
            rustCode += factor === 1 ? `` : ` * ${factor}`;
            rustCode += add === 0 ? `` : ` + ${add}`;
            rustCode = `(${rustCode}) >> ${shift}`;
            if (interType > toType) {
                rustCode = `(${rustCode}) as u${toType}`;
            }
        }

        return [
            `Result: ${formula}`,
            `        f: ${factor}, a: ${add}, s: ${shift}`,
            `        search took ${result.time}ms`,
            ``,
            `/// Converts a value 0..=${inputRange} to a value 0..=${outputRange} by multiplying with ${result.request.T}/${result.request.S} and then rounding with ${result.request.R}.`,
            `fn convert_range(x: u${fromType}) -> u${toType} {`,
            `    debug_assert!(x <= ${inputRange});`,
            `    ${rustCode}`,
            `}`,
        ];
    }, [result]);

    return (
        <pre>
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
                {">>> (S) Divisor:      0 - "}
                <NumberInput
                    className="bg-black"
                    min={1}
                    max={4294967296}
                    value={from}
                    readOnly={linkedInputRange}
                    onChange={setFrom}
                />{" "}
                <label>
                    <input
                        type="checkbox"
                        checked={linkedInputRange}
                        onChange={(e) => {
                            setLinkedInputRange(e.target.checked);
                        }}
                    />{" "}
                    linked to input range
                </label>
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
            {"\n" + resultLines.join("\n")}
        </pre>
    );
}
