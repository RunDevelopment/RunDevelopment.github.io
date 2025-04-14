import { ProblemLike, RoundingMode } from "../../components/multiply-add/interfaces";

export class GmaProblem implements ProblemLike {
    readonly r: number;
    readonly outputRange: number;
    readonly outputRangeExact: bigint;

    constructor(
        public readonly inputRange: number,
        public readonly t: number,
        public readonly d: number,
        public readonly rounding: RoundingMode,
    ) {
        let r;
        switch (this.rounding) {
            case "round":
                r = this.d >> 1;
                break;
            case "floor":
                r = 0;
                break;
            case "ceil":
                r = this.d - 1;
                break;
        }
        this.r = r;

        this.outputRange = Math.floor((this.inputRange * this.t + this.r) / this.d);
        this.outputRangeExact =
            BigInt(this.inputRange) * BigInt(this.t) + BigInt(this.r) / BigInt(this.d);
    }

    static from(problem: ProblemLike): GmaProblem {
        return new GmaProblem(problem.inputRange, problem.t, problem.d, problem.rounding);
    }

    forNecessaryInputs<T>(fn: (x: number) => void | T): T | undefined {
        const { d, inputRange } = this;

        let output;
        if (d < inputRange / 2) {
            for (let x = 1; x <= d; x++) {
                if ((output = fn(x))) return output;
            }
            for (let x = inputRange - d; x <= inputRange; x++) {
                if ((output = fn(x))) return output;
            }
        } else {
            for (let x = 1; x <= inputRange; x++) {
                if ((output = fn(x))) return output;
            }
        }
    }

    /**
     * Whether the linear function y = mx + b is a solution to the given problem.
     */
    isSolution(m: number, n: number): boolean {
        const { t, d, r } = this;

        if (m <= 0 || n < 0 || n >= 1) return false;

        const result = this.forNecessaryInputs((x) => {
            const expected = Math.floor((x * t + r) / d);
            const actual = Math.floor(m * x + n);
            if (expected !== actual) return false;
        });
        return result ?? true;
    }

    /**
     * Returns the range of m values for n=0 and n=1 while only considering x=inputRange.
     */
    solveCurrentForFullM(): [mMinN0: number, mMaxN0: number, mMinN1: number, mMaxN1: number] {
        const { inputRange, outputRange } = this;

        // expected <= m * x + n < expected + 1
        // (expected - n) / x <= m < (expected + 1 - n) / x
        return [
            outputRange / inputRange,
            (outputRange + 1) / inputRange,
            (outputRange - 1) / inputRange,
            outputRange / inputRange,
        ];
    }

    solveForN(m: number): [nMin: number, nMax: number] | undefined {
        const { t, d, r } = this;

        if (m <= 0) return undefined;

        let nMin = 0;
        let nMax = 1;

        const early = this.forNecessaryInputs((x) => {
            // expected <= m * x + n < expected + 1
            // expected / (m*x) <= n < (expected + 1) / (m*x)
            const expected = Math.floor((x * t + r) / d);
            const n1 = expected / (m * x);
            const n2 = (expected + 1) / (m * x);
            nMin = Math.max(nMin, n1);
            nMax = Math.min(nMax, n2);
            if (nMin >= nMax) return true;
        });
        if (early) return undefined;

        return [nMin, nMax];
    }
    solveForM(n: number): [mMin: number, mMax: number] | undefined {
        const { t, d, r } = this;

        if (n < 0 || n >= 1) return undefined;

        let mMin = -1;
        let mMax = Infinity;

        const early = this.forNecessaryInputs((x) => {
            // expected <= m * x + n < expected + 1
            // (expected - n) / x <= m < (expected + 1 - n) / x
            const expected = Math.floor((x * t + r) / d);
            const m1 = (expected - n) / x;
            const m2 = (expected + 1 - n) / x;
            mMin = Math.max(mMin, m1);
            mMax = Math.min(mMax, m2);
            if (mMin >= mMax) return true;
        });
        if (early) return undefined;

        return [mMin, mMax];
    }

    /**
     * Returns a range of n values inside the given range that are all solutions.
     */
    findSolutionNRange(inRange: [number, number]): [number, number] | undefined {
        let [rangeMin, rangeMax] = inRange;
        const rangeSize = rangeMax - rangeMin;
        const maxStepSize = 1 / this.d;

        // Step 1: find any n that is a solution
        let middleN: number | undefined = undefined;
        for (let stepSize = 0; stepSize <= 10; stepSize++) {
            const steps = 1 << stepSize;
            for (let i = 0; i < steps; i++) {
                const alpha = (i + 0.5) / steps;
                const n = rangeMin + alpha * rangeSize;
                if (this.solveForM(n)) {
                    middleN = n;
                    break;
                }
            }

            if (middleN !== undefined) {
                // done
                break;
            }
            if (1 / steps <= maxStepSize) {
                // search failed
                break;
            }
        }

        // no solutions
        if (middleN === undefined) return undefined;

        // Step 2: find the exact bounds of n with binary search
        let nMin = middleN;
        let nMax = middleN;
        for (let iter = 0; iter < 14; iter++) {
            // min
            const newMin = (nMin + rangeMin) / 2;
            if (this.solveForN(newMin)) {
                nMin = newMin;
            } else {
                rangeMin = newMin;
            }

            // max
            const newMax = (nMax + rangeMax) / 2;
            if (this.solveForN(newMax)) {
                nMax = newMax;
            } else {
                rangeMax = newMax;
            }
        }

        return [nMin, nMax];
    }

    solveForNExact(m: Fraction): [nMin: Fraction, nMax: Fraction] | undefined {
        const { t, d, r } = this;
        m = m.simplify();

        if (m.le0) return undefined;

        let nMin = Fraction.ZERO;
        let nMax = Fraction.ONE;

        const early = this.forNecessaryInputs((x) => {
            // expected <= m * x + n < expected + 1
            // expected / (m*x) <= n < (expected + 1) / (m*x)
            const expected = BigInt(Math.floor((x * t + r) / d));
            const mx = m.multiply(Fraction.fromFloat(x));
            const n1 = new Fraction(expected).div(mx);
            const n2 = new Fraction(expected + 1n).div(mx);
            nMin = nMin.max(n1);
            nMax = nMax.min(n2);
            if (nMin.ge(nMax)) return true;
        });
        if (early) return undefined;

        return [nMin.simplify(), nMax.simplify()];
    }
    solveForMExact(n: Fraction): [mMin: Fraction, mMax: Fraction] | undefined {
        const { t, d, r } = this;
        n = n.simplify();

        if (n.lt0 || n.ge1) return undefined;

        let mMin = Fraction.NEG_ONE;
        let mMax = Fraction.fromFloat(t).div(Fraction.fromFloat(d)).add1();

        const early = this.forNecessaryInputs((x) => {
            // expected <= m * x + n < expected + 1
            // (expected - n) / x <= m < (expected + 1 - n) / x
            const expected = BigInt(Math.floor((x * t + r) / d));
            const en = new Fraction(expected).sub(n);
            const m1 = en.div(Fraction.fromFloat(x));
            const m2 = en.add1().div(Fraction.fromFloat(x));
            mMin = mMin.max(m1);
            mMax = mMax.min(m2);
            if (mMin >= mMax) return true;
        });
        if (early) return undefined;

        return [mMin, mMax];
    }
}

/**
 * A fraction represented by a numerator and a denominator, both bigint.
 */
export class Fraction {
    constructor(numerator: bigint, denominator: bigint);
    constructor(integer: bigint);
    constructor(
        public readonly numerator: bigint,
        public readonly denominator: bigint = 1n,
    ) {
        if (denominator <= 0n) {
            throw new Error("Denominator must be positive");
        }
    }

    /** `this === 0` */
    get eq0(): boolean {
        return this.numerator === 0n;
    }
    /** `this < 0` */
    get lt0(): boolean {
        return this.numerator < 0n;
    }
    /** `this <= 0` */
    get le0(): boolean {
        return this.numerator <= 0n;
    }
    /** `this > 0` */
    get gt0(): boolean {
        return this.numerator > 0n;
    }
    /** `this >= 0` */
    get ge0(): boolean {
        return this.numerator >= 0n;
    }
    /** `this === 1` */
    get eq1(): boolean {
        return this.numerator === this.denominator;
    }
    /** `this < 1` */
    get lt1(): boolean {
        return this.numerator < this.denominator;
    }
    /** `this <= 1` */
    get le1(): boolean {
        return this.numerator <= this.denominator;
    }
    /** `this > 1` */
    get gt1(): boolean {
        return this.numerator > this.denominator;
    }
    /** `this >= 1` */
    get ge1(): boolean {
        return this.numerator >= this.denominator;
    }

    /** `this === other` */
    eq(other: Fraction): boolean {
        return this.numerator * other.denominator === other.numerator * this.denominator;
    }
    /** `this < other` */
    lt(other: Fraction): boolean {
        return this.numerator * other.denominator < other.numerator * this.denominator;
    }
    /** `this <= other` */
    le(other: Fraction): boolean {
        return this.numerator * other.denominator <= other.numerator * this.denominator;
    }
    /** `this > other` */
    gt(other: Fraction): boolean {
        return this.numerator * other.denominator > other.numerator * this.denominator;
    }
    /** `this >= other` */
    ge(other: Fraction): boolean {
        return this.numerator * other.denominator >= other.numerator * this.denominator;
    }

    static readonly ZERO = new Fraction(0n);
    static readonly ONE = new Fraction(1n);
    static readonly NEG_ONE = new Fraction(-1n);

    static fromFloat(f: number): Fraction {
        if (Number.isInteger(f)) {
            return new Fraction(BigInt(f));
        }
        if (f < 0) {
            throw new Error("Fraction must be non-negative");
        }
        if (!Number.isFinite(f)) {
            throw new Error("Fraction must be finite");
        }
        const numerator = BigInt(Math.round(f * 2 ** 53));
        const denominator = BigInt(2 ** 53);
        return new Fraction(numerator, denominator);
    }

    toFloat(): number {
        return Number(this.numerator) / Number(this.denominator);
    }

    add(other: Fraction): Fraction {
        return new Fraction(
            this.numerator * other.denominator + other.numerator * this.denominator,
            this.denominator * other.denominator,
        );
    }
    add1(): Fraction {
        return new Fraction(this.numerator + this.denominator, this.denominator);
    }

    sub(other: Fraction): Fraction {
        return new Fraction(
            this.numerator * other.denominator - other.numerator * this.denominator,
            this.denominator * other.denominator,
        );
    }
    sub1(): Fraction {
        return new Fraction(this.numerator - this.denominator, this.denominator);
    }

    multiply(other: Fraction): Fraction {
        return new Fraction(this.numerator * other.numerator, this.denominator * other.denominator);
    }

    div(other: Fraction): Fraction {
        return new Fraction(this.numerator * other.denominator, this.denominator * other.numerator);
    }

    min(other: Fraction): Fraction {
        return this.lt(other) ? this : other;
    }
    max(other: Fraction): Fraction {
        return this.gt(other) ? this : other;
    }

    simplify(): Fraction {
        const gcd = (a: bigint, b: bigint): bigint => (b === 0n ? a : gcd(b, a % b));
        const g = gcd(this.numerator, this.denominator);
        return new Fraction(this.numerator / g, this.denominator / g);
    }

    toString(): string {
        return `${this.numerator}/${this.denominator}`;
    }
}
