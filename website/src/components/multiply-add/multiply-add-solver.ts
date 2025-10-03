import { assert } from "../../lib/util";

function gcd(a: bigint, b: bigint): bigint {
    if (b == 0n) return a;
    return gcd(b, a % b);
}
function divCeil(a: bigint, b: bigint): bigint {
    return (a + b - 1n) / b;
}
function log2Ceil(x: bigint): bigint {
    if (x <= 0n) {
        throw new Error(`log2Ceil is only defined for positive integers, got ${x}`);
    }
    let n = 0n;
    let v = 1n;
    while (v < x) {
        v *= 2n;
        n += 1n;
    }
    return n;
}
/** Returns a^-1 mod b */
function mul_inv(a: bigint, b: bigint): bigint {
    const b0 = b;
    let x0 = 0n;
    let x1 = 1n;
    if (b == 1n) {
        return 1n;
    }
    while (a > 1n) {
        const q = a / b;
        let t = b;
        b = a % b;
        a = t;
        t = x0;
        x0 = x1 - q * x0;
        x1 = t;
    }
    if (x1 < 0n) {
        x1 += b0;
    }
    return x1;
}
function mod(a: bigint, b: bigint): bigint {
    const r = a % b;
    return r < 0n ? r + b : r;
}

export type RoundingMode = "round" | "floor" | "ceil";

/**
 * Describes the function `p(x) = (x*t + r_d) / d` for `x in 0..=u`.
 */
export class Problem {
    /** The input range of the problem. */
    readonly u: bigint;
    readonly t: bigint;
    readonly d: bigint;
    readonly r_d: bigint;

    get isSimplifiedFraction(): boolean {
        return gcd(this.t, this.d) == 1n;
    }

    constructor(u: bigint, t: bigint, d: bigint, r_d: bigint) {
        assert(u >= 0n && t >= 0n && d > 0n && 0n <= r_d && r_d < d);
        this.u = u;
        this.t = t;
        this.d = d;
        this.r_d = r_d;
    }

    static floor(u: bigint, t: bigint, d: bigint): Problem {
        return new Problem(u, t, d, 0n);
    }
    static ceil(u: bigint, t: bigint, d: bigint): Problem {
        return new Problem(u, t, d, d - 1n);
    }
    static round(u: bigint, t: bigint, d: bigint): Problem {
        return new Problem(u, t, d, d / 2n);
    }

    simplify(): Problem {
        if (this.at(this.u) == 0n) {
            // the problem is a constant 0 function for the given range
            return new Problem(this.u, 0n, 1n, 0n);
        }

        const g = gcd(this.t, this.d);
        return new Problem(this.u, this.t / g, this.d / g, this.r_d / g);
    }

    /**
     * Returns the value of the function at `x`.
     */
    at(x: bigint): bigint {
        return (x * this.t + this.r_d) / this.d;
    }

    /** Returns any solution to the problem. */
    primitiveSolution(): Solution {
        const { u, t, d, r_d } = this;

        const s = log2Ceil((u + 1n) * d);
        const f = ((t << s) + d - 1n) / d;
        const a = ((r_d << s) + d - 1n) / d;

        return new Solution(f, a, s);
    }

    solve(inputSetLimit: number = 1000): Solver {
        return new Solver(this, inputSetLimit);
    }

    /** Verifies that a given solution is correct for all inputs. */
    verify(solution: Solution | SolutionRange, options?: VerifyOptions): boolean {
        if (solution instanceof SolutionRange) {
            const min = new Solution(solution.f, solution.A.min, solution.s);
            const max = new Solution(solution.f, solution.A.max, solution.s);
            return this.verify(min, options) && this.verify(max, options);
        }

        const inputLimit = options?.inputLimit ?? 1000;

        const p = this.simplify();
        // we only need to check the first and last d inputs
        if (p.d * 2n <= p.u) {
            if (Number(p.d * 2n) > inputLimit) {
                throw new InputLimitExceeded(`Input limit of ${inputLimit} exceeded`);
            }

            for (let i = 0n; i <= p.d; i++) {
                if (p.at(i) !== solution.at(i)) return false;
                const i2 = p.u - i;
                if (p.at(i2) !== solution.at(i2)) return false;
            }
        } else {
            if (Number(p.u) > inputLimit) {
                throw new InputLimitExceeded(`Input limit of ${inputLimit} exceeded`);
            }

            for (let i = 0n; i <= p.u; i++) {
                if (p.at(i) !== solution.at(i)) return false;
            }
        }

        return true;
    }

    toString(): string {
        return `Problem(u=${this.u}, t=${this.t}, d=${this.d}, r_d=${this.r_d})`;
    }
}
export interface VerifyOptions {
    inputLimit?: number;
}

export class InputLimitExceeded extends Error {}

export class Solution {
    readonly f: bigint;
    readonly a: bigint;
    readonly s: bigint;

    constructor(f: bigint, a: bigint, s: bigint) {
        this.f = f;
        this.a = a;
        this.s = s;
    }

    /**
     * Returns the smallest solution from which this solution was derived.
     */
    original(): Solution {
        let { f, a, s } = this;

        while (s > 0n && f % 2n == 0n) {
            f /= 2n;
            a /= 2n;
            s -= 1n;
        }

        return new Solution(f, a, s);
    }

    /**
     * Returns the value of the function at `x`.
     */
    at(x: bigint): bigint {
        return (x * this.f + this.a) >> this.s;
    }

    requiredBits(inputRange: bigint): Bits {
        const { f, a, s } = this;
        const outputRange = (inputRange * f + a) >> BigInt(s);
        const maxIntermediate = inputRange * f + a;

        return new Bits(
            inputRange.toString(2).length,
            outputRange.toString(2).length,
            maxIntermediate.toString(2).length,
        );
    }

    /**
     * Returns a derived solution where the shift has been optimized to be
     * more efficient in hardware by some heuristic.
     */
    optimize(inputRange: bigint): Solution {
        if (this.s === 0n) {
            // shift is perfect
            return this;
        }
        if (this.f === 1n) {
            // f=1 means that we don't need a multiplication
            // Since increasing the shift might require a multiplication again,
            // the current solution is always better.
            return this;
        }

        // Heuristic: Ideally, the shift should be:
        // 1. A power of two
        // 2. Half of the type size of intermediate type
        // 3. A multiple of the type size of the output type

        const getIntermediateTypeSize = (solution: Solution) => {
            const bits = solution.requiredBits(inputRange);
            return Bits.typeSize(bits.intermediate);
        };

        const bits = this.requiredBits(inputRange);
        const outputType = Bits.typeSize(bits.output);
        const interType = Bits.typeSize(bits.intermediate);

        // eslint-disable-next-line @typescript-eslint/no-this-alias
        let best: Solution = this;
        const testShift = (shift: bigint) => {
            if (shift <= best.s) return;

            const diff = shift - best.s;
            const f = best.f << diff;
            // choose a nice-looking add value if possible
            const a =
                best.a !== best.f && best.a === 2n ** BigInt(best.s) - 1n
                    ? 2n ** BigInt(shift) - 1n
                    : best.a << diff;
            const candidate = new Solution(f, a, shift);

            if (getIntermediateTypeSize(candidate) === interType) {
                best = candidate;
            }
        };

        // 1. Try to make it a power of two
        if (best.s > 8n) {
            testShift(1n << log2Ceil(best.s));
        }

        // 2. Try to make it half of the intermediate type size
        if (interType >= 16) {
            testShift(BigInt(interType / 2));
        }

        // 3. Try to make it a multiple of the output type size
        testShift(divCeil(best.s, BigInt(outputType)) * BigInt(outputType));

        return best;
    }
}
export class Bits {
    constructor(
        /** Number of bits required to represent the input range. */
        readonly input: number,
        /** Number of bits required to represent the output range. */
        readonly output: number,
        /** Number of bits required to represent the intermediate values. */
        readonly intermediate: number,
    ) {}

    /**
     * Given the number of bits required to represent a number, returns the smallest
     * bit-width of a fixed-size unsigned integer that can hold that number.
     *
     * Example: `bitsToTypeSize(3) === 8` and `bitsToTypeSize(9) === 16`
     */
    static typeSize(bits: number): number {
        return Math.max(8, 2 ** Math.ceil(Math.log2(bits)));
    }
}

export class SolutionRange {
    readonly f: bigint;
    readonly A: Range;
    readonly s: bigint;

    constructor(f: bigint, A: Range, s: bigint) {
        this.f = f;
        this.A = A;
        this.s = s;
    }
    static from(solution: Solution | SolutionRange): SolutionRange {
        if (solution instanceof SolutionRange) {
            return solution;
        }
        return new SolutionRange(solution.f, new Range(solution.a, solution.a), solution.s);
    }

    pickAny(): Solution {
        // while we can pick anything, we want to pick something nice
        const { f, A, s } = this;

        let a;
        if (A.min == 0n) {
            a = 0n;
        } else if (A.min <= f && f <= A.max) {
            a = f;
        } else if (A.max == (1n << s) - 1n) {
            a = A.max;
        } else {
            a = A.min;
        }

        return new Solution(f, a, s);
    }

    /**
     * Returns the smallest solution from which this solution was derived.
     */
    original(): SolutionRange {
        let { f, A, s } = this;

        while (s > 0n && f % 2n == 0n) {
            f /= 2n;
            A = new Range(A.min / 2n, A.max / 2n);
            s -= 1n;
        }

        return new SolutionRange(f, A, s);
    }
}

export class Range {
    readonly min: bigint;
    readonly max: bigint;

    constructor(min: bigint, max: bigint) {
        if (min > max) {
            throw new Error(`Invalid range: min=${min}, max=${max}`);
        }
        this.min = min;
        this.max = max;
    }
}

export class Solver {
    private readonly r: Reducer;
    private readonly inputSet: readonly bigint[];

    constructor(p: Problem, inputSetLimit: number) {
        const r = Reducer.create(p.simplify());
        this.r = r;

        const inputSet = getInputSet(r.reduced, inputSetLimit);
        if (!inputSet) {
            throw new InputLimitExceeded("Input set size exceeded the limit of " + inputSetLimit);
        }
        this.inputSet = inputSet;
    }

    zeroSolution(): Solution | null {
        const solution = findAZero(this.r.reduced, this.inputSet);
        if (solution) {
            return this.r.apply(solution);
        }
        return null;
    }

    smallestSolution(): SolutionRange {
        const solution = algorithm2(this.r.reduced, this.inputSet);
        return this.r.applyRange(solution);
    }

    *iterateSolutions(): Iterable<SolutionRange> {
        for (const s of iterSolutionSpace(this.r.reduced, this.inputSet)) {
            yield this.r.applyRange(s);
        }
    }
}

class Reducer {
    readonly reduced: Problem;
    private readonly k: bigint;

    private constructor(reduced: Problem, k: bigint) {
        this.reduced = reduced;
        this.k = k;
    }

    static create(p: Problem): Reducer {
        const { u, t, d, r_d } = p;

        const k = t / d;
        const reduced = new Problem(u, t % d, d, r_d);
        return new Reducer(reduced, k);
    }

    apply(solution: Solution): Solution {
        const { f, a, s } = solution;
        return new Solution(f + (this.k << s), a, s);
    }

    applyRange(solutionRange: SolutionRange): SolutionRange {
        const { f, A, s } = solutionRange;
        return new SolutionRange(f + (this.k << s), A, s);
    }
}

function* iterSolutionSpace(p: Problem, inputSet: readonly bigint[]): Iterable<SolutionRange> {
    assert(p.isSimplifiedFraction);
    assert(p.t < p.d);

    const minimal = algorithm2(p, inputSet);
    yield minimal;

    let lastIter = [minimal];
    for (;;) {
        const nextIter: SolutionRange[] = [];

        const start = lastIter[0];
        if (start.f >= 1n) {
            const prev = algorithm_1a(p, start.f * 2n - 1n, start.s + 1n, inputSet);
            if (prev) {
                nextIter.push(prev);
                yield prev;
            }
        }

        for (const s of lastIter) {
            const derived = new SolutionRange(
                s.f * 2n,
                new Range(s.A.min * 2n, s.A.max * 2n + 1n),
                s.s + 1n,
            );
            nextIter.push(derived);
            yield derived;

            const next = algorithm_1a(p, s.f * 2n + 1n, s.s + 1n, inputSet);
            if (next) {
                nextIter.push(next);
                yield next;
            }
        }

        lastIter = nextIter;
    }
}

/**
 * Returns a tuple of a solution range and whether the solution range is
 * guaranteed to be minimal.
 */
function algorithm2(p: Problem, inputSet: readonly bigint[]): SolutionRange {
    assert(p.isSimplifiedFraction);
    assert(p.t < p.d);

    if (p.t == 0n || p.d == 1n) {
        // trivial solution
        return new SolutionRange(p.t, new Range(0n, 0n), 0n);
    }

    // use the un-derived primitive solution as the starting point
    const primitiveSolution = p.primitiveSolution().original();

    if (primitiveSolution.s == 0n) {
        // trivially minimal
        return SolutionRange.from(primitiveSolution);
    }

    let solution = algorithm_1a(p, primitiveSolution.f, primitiveSolution.s, inputSet);
    assert(solution != null);

    for (;;) {
        assert(solution.f % 2n === 1n);

        const lastS = solution.s;
        for (const f of [solution.f - 1n, solution.f + 1n]) {
            const next = algorithm_1a(p, f, lastS, inputSet);
            if (next) {
                solution = next.original();
                break;
            }
        }

        if (solution.s == 0n || solution.s == lastS) {
            // found the minimal solution range
            return solution;
        }
    }
}

function findAZero(p: Problem, inputSet: readonly bigint[]): Solution | null {
    assert(p.isSimplifiedFraction);
    assert(p.t < p.d);
    const { u, t, d } = p;

    if (t == 0n || d == 1n) {
        // trivial solution
        return new Solution(t, 0n, 0n);
    }

    // guess an s that is too large; +10 to be safe
    const s = log2Ceil(u * d) + 10n;
    const F = algorithm_1f(p, 0n, s, inputSet);
    if (F == null) {
        return null;
    }

    const f = pick_most_even(F);

    return new Solution(f, 0n, s).original();
}

/** Returns the most even number in the range. */
function pick_most_even(range: Range): bigint {
    let a = range.min;
    let b = range.max;

    if (a == 0n) {
        return 0n;
    }

    let scale = 0;
    while (a < b) {
        scale += 1;
        a = (a + 1n) >> 1n;
        b = b >> 1n;
    }

    return a << BigInt(scale);
}

function algorithm_1f(p: Problem, a: bigint, s: bigint, inputs: readonly bigint[]): Range | null {
    const { u, t, d, r_d } = p;
    const v = p.at(u);

    let fMin = divCeil((v << s) - a, u);
    let fMax = (((v + 1n) << s) - a) / u;

    for (const x of inputs) {
        if (x == 0n) continue; // skip x=0, it gives no information about f

        const y = (x * t + r_d) / d;

        const f1 = divCeil((y << s) - a, x);
        const f2 = (((y + 1n) << s) - 1n - a) / x;

        if (f1 > fMin) fMin = f1;
        if (f2 < fMax) fMax = f2;

        if (fMin > fMax) {
            return null;
        }
    }

    return new Range(fMin, fMax);
}

function algorithm_1a(
    p: Problem,
    f: bigint,
    s: bigint,
    inputs: readonly bigint[],
): SolutionRange | null {
    const { t, d, r_d } = p;

    let aMin = 0n;
    let aMax = (1n << s) - 1n;

    for (const x of inputs) {
        const y = (x * t + r_d) / d;

        const a1 = (y << s) - f * x;
        const a2 = ((y + 1n) << s) - 1n - f * x;

        if (a1 > aMin) aMin = a1;
        if (a2 < aMax) aMax = a2;

        if (aMin > aMax) {
            return null;
        }
    }

    return new SolutionRange(f, new Range(aMin, aMax), s);
}

function getInputSet(p: Problem, sizeLimit: number): bigint[] | null {
    const { u, t, d, r_d } = p;

    assert(t < d);
    assert(p.isSimplifiedFraction);

    if (t === 0n) {
        // for constant zero function, we just need to check the boundaries
        return [0n, u];
    }

    if (0n < t && t < d && gcd(t, d) == 1n && d * 2n <= u) {
        // conjecture 14
        const t_inv = mul_inv(t, d);
        const x_bc = mod(-t_inv * (r_d + 1n), d);
        const x_ad = mod(-t_inv * r_d, d);
        const x1 = x_bc;
        const x2 = x_ad;
        let x3 = (u / d) * d + x_bc;
        let x4 = (u / d) * d + x_ad;
        if (x3 > u) x3 -= d;
        if (x4 > u) x4 -= d;
        return [x1, x2, x3, x4];
    }

    let tooBig = false;

    const inputs = new Set<bigint>();
    const addRange = (start: bigint, stop: bigint) => {
        inputs.add(start);
        inputs.add(stop);
        const jump = d / t - 1n;

        if (jump > 0n) {
            const expectedSize = ((stop - start + 1n) * t) / d;
            if (Number(expectedSize) > sizeLimit) {
                tooBig = true;
                return;
            }

            let last = p.at(start);

            // skip to the first x value for which p.at(x) > last
            let x = ((last + 1n) * d - r_d) / t - 1n;
            while (x < stop && p.at(x) <= last) x += 1n;

            if (x > stop) return;

            inputs.add(x - 1n);
            inputs.add(x);
            last = p.at(x);

            for (;;) {
                if (inputs.size > sizeLimit) return;

                x += jump;
                let current = p.at(x);
                while (current == last) {
                    x += 1n;
                    current = p.at(x);
                }

                if (x > stop) break;

                inputs.add(x - 1n);
                inputs.add(x);
                last = current;
            }
        } else {
            // full range
            const expectedSize = stop - start + 1n;
            if (Number(expectedSize) > sizeLimit) {
                tooBig = true;
                return;
            }

            for (let x = start + 1n; x < stop; x += 1n) {
                if (inputs.size > sizeLimit) return;
                inputs.add(x);
            }
        }
    };

    if (d * 2n <= u) {
        addRange(0n, d - 1n);
        addRange(u - (d - 1n), u);
    } else {
        addRange(0n, u);
    }

    if (inputs.size > sizeLimit || tooBig) return null;

    return Array.from(inputs);
}
