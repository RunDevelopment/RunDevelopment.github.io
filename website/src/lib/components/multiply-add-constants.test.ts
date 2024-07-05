import {
    bruteForceAllSolutions,
    ConversionRange,
    Request,
    RoundingFunction,
    SearchOptions,
} from "./multiply-add-constants";

describe("multiplyAddConstants", () => {
    const U = 100;
    const options: SearchOptions = {
        maxShiftAfterFirstSolution: 4,
    };

    const printSolutions = (solutions: ConversionRange[]): string[] => {
        solutions.sort((a, b) => {
            if (a.shift !== b.shift) return a.shift - b.shift;
            if (a.factor !== b.factor) return a.factor - b.factor;
            return a.add[0] - b.add[0];
        });

        const factorLength = solutions.at(-1)?.factor.toString().length ?? 5;

        const printAdd = (add: [number, number]) =>
            add[0] === add[1] ? String(add[0]) : add.join("-");
        const addLength = solutions.reduce(
            (max, { add }) => Math.max(max, printAdd(add).length),
            0,
        );

        const strings = solutions.map(({ factor, add, shift }) => {
            const f = String(factor).padEnd(factorLength);
            const a = printAdd(add).padEnd(addLength);
            return `s=${String(shift).padEnd(2)} f=${f} a=${a}  (${add[1] - add[0] + 1})`;
        });

        for (let i = solutions.length - 1; i > 0; i--) {
            if (solutions[i].shift !== solutions[i - 1].shift) {
                strings.splice(i, 0, "");
            }
        }

        return strings;
    };
    const findSolutions = async (request: Request): Promise<string> => {
        const solutions: ConversionRange[] = [];
        for await (const solution of bruteForceAllSolutions(request, options, undefined)) {
            solutions.push(solution);
        }

        if (solutions.length === 0) {
            return "No solutions found";
        }

        return printSolutions(solutions)
            .map((s) => "\n" + ("        " + s).trimEnd())
            .join("");
    };

    for (let D = 1; D <= U; D++) {
        for (let T = 1; T <= 10; T++) {
            it(`Solutions for U=${U} D=${D} T=${T}`, async () => {
                const results: Record<string, unknown> = {};
                for (const method of ["round", "floor", "ceil"] satisfies RoundingFunction[]) {
                    results[method] = await findSolutions({ inputRange: U, R: method, D, T });
                }
                expect(results).toMatchSnapshot();
            });
        }
    }
});
