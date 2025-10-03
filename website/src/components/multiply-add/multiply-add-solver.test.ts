import { Problem, Solution, SolutionRange } from "./multiply-add-solver";

function gcd(a: bigint, b: bigint): bigint {
    if (b == 0n) return a;
    return gcd(b, a % b);
}

const toString = (solution: Solution | SolutionRange) => {
    const { f, A, s } = SolutionRange.from(solution);
    const { min: aMin, max: aMax } = A;
    if (aMin === aMax) {
        return `s=${s} f=${f} a=${aMin}`;
    } else {
        return `s=${s} f=${f} a=${aMin}..=${aMax}`;
    }
};
const format = <T extends Solution | SolutionRange | null>(
    p: Problem,
    f: () => T,
): string | (T extends null ? null : never) => {
    let solution;
    try {
        solution = f();
    } catch (e) {
        return String(e);
    }

    if (solution === null) return null as never;
    const correct = p.verify(solution);
    if (!correct) {
        throw new Error("Invalid solution generated for problem " + p);
    }
    return toString(solution);
};

describe("MA:", () => {
    const MAX = 100n;
    const roundings = ["floor", "round", "ceil"] as const;
    for (let d = 2n; d <= MAX; d++) {
        for (let t = 1n; t <= MAX; t++) {
            if (d === t) continue;
            if (gcd(d, t) != 1n) continue;

            test(`t/d=${t}/${d}    `, () => {
                let s = "";
                for (const u of [49n]) {
                    s += `u=${u}\n`;
                    for (const rounding of roundings) {
                        s += `  ${rounding}\n`;
                        const p = Problem[rounding](u, t, d);
                        const solve = p.solve();
                        const primitive = format(p, () => p.primitiveSolution().original());
                        const minimal = format(p, () => solve.smallestSolution());
                        const zero = format(p, () => solve.zeroSolution());
                        s += `    primitive: ${primitive}\n`;
                        if (zero) s += `    zero:      ${zero}\n`;
                        s += `    in order:  ${minimal}\n`;
                        try {
                            let count = -1;
                            let min = undefined;
                            for (const solution of solve.iterateSolutions()) {
                                count++;
                                if (count === 0) {
                                    min = solution;
                                    continue;
                                }
                                if (min && solution.s >= min.s + 3n) break;
                                s += `               ${format(p, () => solution)}\n`;
                            }
                        } catch {
                            /* ignore */
                        }
                    }
                }
                expect(s).toMatchSnapshot();
            });
        }
    }
});
