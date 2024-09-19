export type RoundingFunction = "round" | "floor" | "ceil";
export interface Request {
    inputRange: number;
    R: RoundingFunction;
    D: number;
    T: number;
}
export interface SearchOptions {
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
export interface Conversion {
    factor: number;
    add: number;
    shift: number;
}
export interface ConversionRange {
    factor: number;
    add: [min: number, max: number];
    shift: number;
}

export async function* bruteForceAllSolutions(
    { inputRange, R, D, T }: Request,
    {
        maxShiftAfterFirstSolution = 0,
        onlySmallestAdd = false,
        onlyMinimalSolutions = false,
        maxShift = 64,
    }: SearchOptions,
    signal: AbortSignal | undefined,
): AsyncIterable<ConversionRange> {
    // Everything needs to be in one function, so we can transfer the function to the worker

    // make everything more efficient by reducing the fraction
    function gcd(a: number, b: number): number {
        return b === 0 ? a : gcd(b, a % b);
    }
    const g = gcd(T, D);
    T /= g;
    D /= g;

    const debug = 0;

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

            let validAddMin = Infinity;
            let validAddMax = -Infinity;
            for (let add = addMin; add <= addMax; add++) {
                const candidate = { factor, add, shift };
                if (getActual(inputRange, candidate) === outputRange && exhaustiveTest(candidate)) {
                    if (onlySmallestAdd) {
                        yield { factor, add: [add, add], shift };
                    } else {
                        validAddMin = Math.min(validAddMin, add);
                        validAddMax = Math.max(validAddMax, add);
                    }
                }
            }

            if (validAddMin <= validAddMax && !onlySmallestAdd) {
                yield { factor, add: [validAddMin, validAddMax], shift };
            }

            if (debug >= 2 && rejectedCount > 0) {
                console.log(`Rejected for ${lastRejected} a total of ${rejectedCount} times`);
            }
        };
    };
    const createCheck2 = () => {
        let testInputs: number[] | undefined = undefined;
        const safeJumpDist = Math.ceil(D / T - 1);
        const expectedRelevantInputs = (inputRange / D) * T * 2;
        if (safeJumpDist > 2 && expectedRelevantInputs < 10e6) {
            // If getExpected(x0) == getExpected(x1) and x0 < x1,
            // then we don't need to check all xi, x0 < xi < x1
            const inputs = new Set<number>([0, inputRange]);

            const findNextUp = (prev: number) => {
                const e = getExpected(prev);
                let l = prev + 1;
                let h = Math.min(l + safeJumpDist + 1, inputRange);
                if (getExpected(h) === e) {
                    if (h !== inputRange) throw new Error("Unexpected");
                    return inputRange;
                }
                h++; // exclusive
                while (l < h) {
                    const m = Math.floor((l + h) / 2);

                    const e0 = getExpected(m - 1);
                    const e1 = getExpected(m);
                    if (e0 != e1) {
                        return m;
                    } else if (e0 === e) {
                        l = m + 1;
                    } else {
                        h = m;
                    }
                }
                throw new Error("Unexpected");
            };
            const findNextUpSkip = (prev: number) => {
                const e = getExpected(prev);
                for (let i = prev + safeJumpDist - 1; i < inputRange; i++) {
                    if (getExpected(i) !== e) {
                        return i;
                    }
                }
                return inputRange;
            };
            /** 0 <= start < until <= inputRange */
            const addInputs = (start: number, until: number) => {
                inputs.add(start);
                inputs.add(until);
                inputs.add(until - 1);

                for (let j = findNextUp(start); j < until; j = findNextUpSkip(j)) {
                    inputs.add(j);
                    inputs.add(j - 1);
                }
            };

            addInputs(0, Math.min(inputRange, D));
            if (inputRange > D) {
                addInputs(Math.max(D, inputRange - D), inputRange);
            }

            testInputs = Array.from(inputs);
        }

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
                    if (debug >= 2) {
                        console.log(`x=${x}: Narrowed range to addMin=${addMin} addMax=${addMax}`);
                    }
                } else {
                    // if any a, addMin <= a <= addMax reject, then the entire range rejects
                    // TODO: bigint
                    if (Math.floor((x * factor + addMin) / shiftAbs) !== expected) {
                        addMax = -1;
                        if (debug >= 2) {
                            console.log(
                                `x=${x}: Narrowed range to addMin=${addMin} addMax=${addMax}`,
                            );
                        }
                    }
                }
            };

            // start by narrowing with inputRange, which always seems to e highly effective
            narrowFor(inputRange, outputRange);

            // narrow add range
            if (testInputs) {
                // use pre-computed inputs
                for (const i of testInputs) {
                    narrowFor(i, getExpected(i));

                    if (addMin > addMax) {
                        // we ruled out all add values
                        return;
                    }
                }
            } else {
                // iterate all inputs
                const max = Math.round(Math.min(inputRange / 2, D));
                for (let i = 1; i <= max; i++) {
                    narrowFor(i, getExpected(i));
                    narrowFor(inputRange - i, getExpected(inputRange - i));

                    if (addMin > addMax) {
                        // we ruled out all add values
                        return;
                    }
                }
            }

            if (debug >= 1) {
                console.log(`Found ${addMax - addMin + 1} add values`);
            }
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

    let prevValidFactor = undefined;
    for (let shift = 0; shift < maxShift; shift++) {
        const shiftAbs = 2 ** shift;

        const factorsToCheck = getClosestOffIntegers(shift);
        if (prevValidFactor !== undefined) {
            factorsToCheck.push(prevValidFactor * 2);
        }
        const checkedFactors = new Set<number>(factorsToCheck);
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

            if (signal !== undefined) {
                await yieldThread();
                signal.throwIfAborted();
            }

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
                prevValidFactor = factor;
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
