import { lazy } from "@/lib/util";
import { useEffect, useMemo, useState } from "react";

interface Conversion {
    factor: number;
    add: number;
    shift: number;
}

function bruteForceSync(from: number, to: number): Conversion | null {
    const getActual = (i: number, { factor, shift, add }: Conversion) => {
        // use bigint, because bit-shift is 32-bit only
        return Number((BigInt(i) * BigInt(factor) + BigInt(add)) >> BigInt(shift));
    };
    const getExpected = (i: number) => Math.round((i * to) / from);

    const expectedArray: number[] = [];
    for (let i = 0; i <= from; i++) {
        expectedArray.push(getExpected(i));
    }

    // values that are very likely to be rejected
    const rejectTestValues = new Set<number>([0, 1, from - 1, from]);

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
        if (from * conversion.factor + conversion.add < Number.MAX_SAFE_INTEGER) {
            // slower with floor division
            const { factor, add, shift } = conversion;
            const div = 2 ** shift;

            // start with values that were rejected before
            for (const i of rejectTestValues) {
                if (Math.floor((i * factor + add) / div) !== expectedArray[i]) {
                    return false;
                }
            }

            // test all values
            for (let i = 0; i <= from; i++) {
                if (Math.floor((i * factor + add) / div) !== expectedArray[i]) {
                    rejectTestValues.add(i);
                    if (i !== lastRejected) {
                        if (rejectedCount > 0) {
                            console.log(
                                `Rejected for ${lastRejected} a total of ${rejectedCount} times`,
                            );
                        }
                        // console.log(`Rejected for ${i}`);
                        lastRejected = i;
                        rejectedCount = 1;
                    } else {
                        rejectedCount++;
                    }
                    return false;
                }
            }
            return true;
        } else {
            // slowest bigint

            // start with values that were rejected before
            for (const i of rejectTestValues) {
                if (getActual(i, conversion) !== expectedArray[i]) {
                    return false;
                }
            }

            // test all values
            for (let i = 0; i <= from; i++) {
                if (getActual(i, conversion) !== expectedArray[i]) {
                    rejectTestValues.add(i);
                    return false;
                }
            }
        }
        return true;
    };

    const getClosestOffIntegers = (f: number) => {
        const closest = Math.round(f);
        if (closest % 2 === 0) {
            const low = closest - 1;
            const high = closest + 1;
            const lowDist = Math.abs(f - low);
            const highDist = Math.abs(f - high);
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

    for (let shift = 0; shift < 64; shift++) {
        const shiftAbs = 2 ** shift;

        for (const factor of getClosestOffIntegers((to * shiftAbs) / from)) {
            const start = performance.now();

            let addMin = 0;
            let addMax = shiftAbs - 1;

            if (getActual(from, { factor, add: addMin, shift }) > to) {
                // the factor is too high
                break;
            }
            if (getActual(from, { factor, add: addMax, shift }) < to) {
                // the factor is too low
                continue;
            }

            console.log(`factor=${factor} shift=${shift}`);

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

            console.log(`kValues=${kValues.length} minSteps=${minSteps} maxSteps=${maxSteps}`);

            if (addMin <= addMax) {
                console.log(`Exhaustive test for ${addMax - addMin + 1} add values`);
                lastRejected = null;
                rejectedCount = 0;
                for (let add = addMin; add <= addMax; add++) {
                    const candidate = { factor, add, shift };
                    if (getActual(from, candidate) === to && exhaustiveTest(candidate)) {
                        return candidate;
                    }
                }
                if (rejectedCount > 0) {
                    console.log(`Rejected for ${lastRejected} a total of ${rejectedCount} times`);
                }
            }
            console.log(`Rejected in ${performance.now() - start}ms`);
        }
    }

    return null;
}

const webWorkerBruteForce = lazy(() => {
    const onmessage = (e: MessageEvent) => {
        const { id, from, to } = e.data;
        try {
            const start = Date.now();
            const conversion = bruteForceSync(from, to);
            const time = Date.now() - start;
            postMessage({ id, conversion, from, to, time });
        } catch (e) {
            postMessage({ id, error: String(e) });
        }
    };

    const worker = new Worker(
        URL.createObjectURL(
            new Blob([bruteForceSync.toString() + "\nonmessage = " + onmessage.toString()], {
                type: "application/javascript",
            }),
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

    return (from: number, to: number) => {
        const id = idCounter++;
        worker.postMessage({ id, from, to });
        return new Promise<BruteForceResult>((resolve, reject) => {
            listeners.set(id, (result) => {
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve({
                        conversion: result.conversion,
                        time: result.time,
                        from: result.from,
                        to: result.to,
                    });
                }
            });
        });
    };
});

interface BruteForceResult {
    conversion: Conversion | null;
    from: number;
    to: number;
    time: number;
}

async function bruteForce(from: number, to: number): Promise<BruteForceResult> {
    if (typeof Worker !== "undefined") {
        return webWorkerBruteForce()(from, to);
    }
    const start = Date.now();
    const conversion = bruteForceSync(from, to);
    const time = Date.now() - start;
    return { conversion, time, from, to };
}

interface NumberInputProps {
    value: number;
    // eslint-disable-next-line no-unused-vars
    onChange: (value: number) => void;
    min: number;
    max: number;
    className?: string;
}
function NumberInput({ value, onChange, min, max, className }: NumberInputProps) {
    const [text, setText] = useState(value.toString());

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
            className={className}
            min={min}
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

export function ConversionConstantsSearch() {
    const [from, setFrom] = useState(31);
    const [to, setTo] = useState(255);

    const [result, setResult] = useState<BruteForceResult>({
        conversion: { factor: 527, add: 23, shift: 6 },
        from,
        to,
        time: 0,
    });
    useEffect(() => {
        bruteForce(from, to).then(setResult, (e) => console.error(e));
    }, [from, to]);

    const resultLines = useMemo(() => {
        if (!result.conversion) {
            return ["Result: nothing found."];
        }

        const { factor, add, shift } = result.conversion;

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

        const fromType = bitsToTypeSize(Math.log2(result.from + 1));
        const toType = bitsToTypeSize(Math.log2(result.to + 1));
        let rustCode;

        let formula;
        if (add === 0 && shift === 0) {
            formula = `x * ${factor}`;
            if (fromType < toType) {
                rustCode = `x as u${toType} * ${factor}`;
            } else {
                rustCode = `x * ${factor}`;
            }
        } else {
            const maxIntermediate = result.from * factor + add;
            const interBits = Math.ceil(Math.log2(maxIntermediate));
            formula = `(x * ${factor} + ${add}) >> ${shift}  (${interBits} bits required)`;

            const interType = bitsToTypeSize(interBits);

            const inter = interType > fromType ? ` as u${interType}` : "";
            rustCode = `(x${inter} * ${factor} + ${add}) >> ${shift}`;
            if (interType > toType) {
                rustCode = `(${rustCode}) as u${toType}`;
            }
        }

        return [
            `Result: ${formula}`,
            `        f: ${factor}, a: ${add}, s: ${shift}`,
            `        took ${result.time}ms`,
            ``,
            `/// Converts a value 0..=${result.from} to a value 0..=${result.to}`,
            `fn convert_range(x: u${fromType}) -> u${toType} {`,
            `    debug_assert!(x <= ${result.from});`,
            `    ${rustCode}`,
            `}`,
        ];
    }, [result]);

    return (
        <pre>
            <div>
                {">>> From  0 - "}
                <NumberInput
                    className="bg-black"
                    min={2}
                    max={4294967296}
                    value={from}
                    onChange={setFrom}
                />
            </div>
            <div>
                {">>> To    0 - "}
                <NumberInput
                    className="bg-black"
                    min={2}
                    max={4294967296}
                    value={to}
                    onChange={setTo}
                />
            </div>
            {"\n" + resultLines.join("\n")}
        </pre>
    );
}
