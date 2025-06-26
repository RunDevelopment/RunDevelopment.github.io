import { memo } from "react";
import { ProblemLike, SolutionLike } from "./interfaces";
import { CodeBlock } from "../md/CodeBlock";

/**
 * Given the number of bits required to represent a number, returns the smallest
 * bit-width of a fixed-size unsigned integer that can hold that number.
 *
 * Example: `bitsToTypeSize(3) === 8` and `bitsToTypeSize(9) === 16`
 */
export const bitsToTypeSize = (bits: number) => Math.max(8, 2 ** Math.ceil(Math.log2(bits)));

export const getIntermediateTypeSize = (inputRange: number, solution: SolutionLike) => {
    const bits = getRequiredBits(solution, inputRange);
    return bitsToTypeSize(bits.intermediate);
};

interface Bits {
    input: number;
    output: number;
    intermediate: number;
}
function getRequiredBits({ factor, add, shift }: SolutionLike, inputRange: number): Bits {
    const outputRange = (BigInt(inputRange) * factor + add) >> BigInt(shift);
    const maxIntermediate = BigInt(inputRange) * factor + add;

    return {
        input: inputRange.toString(2).length,
        output: outputRange.toString(2).length,
        intermediate: maxIntermediate.toString(2).length,
    };
}
interface CodeGenOptions {
    comment?: string;
    noComment?: boolean;
    functionName?: string;
}
interface GeneratedCode {
    rust: string;
    c: string;
}
function generateCode(
    solution: SolutionLike,
    problem: ProblemLike,
    options?: CodeGenOptions,
): GeneratedCode {
    const { factor, add, shift } = solution;
    const { inputRange, t: T, d: D, rounding: R } = problem;
    const outputRange = (BigInt(inputRange) * factor + add) >> BigInt(shift);

    const roundingComment: Record<ProblemLike["rounding"], string> = {
        round: "rounding",
        floor: "rounding down",
        ceil: "rounding up",
    };
    const bits = getRequiredBits(solution, problem.inputRange);

    const fromType = bitsToTypeSize(bits.input);
    const toType = bitsToTypeSize(bits.output);

    const {
        noComment,
        comment = `Converts a value 0..=${inputRange} to 0..=${outputRange}\nby multiplying with ${T}/${D} and then ${roundingComment[R]}.`,
        functionName = "convert_range",
    } = options || {};

    let rustExpr, cExpr;
    if (add === 0n && shift === 0) {
        rustExpr = fromType < toType ? `x as u${toType}` : `x`;
        rustExpr += factor === 1n ? `` : ` * ${factor}`;

        cExpr = fromType < toType ? `(uint${toType}_t)x` : `x`;
        cExpr += factor === 1n ? `` : ` * ${factor}`;
    } else {
        const interType = bitsToTypeSize(bits.intermediate);

        rustExpr = fromType < interType ? `x as u${interType}` : `x`;
        rustExpr += factor === 1n ? `` : ` * ${factor}`;
        rustExpr += add === 0n ? `` : ` + ${add}`;
        rustExpr = `${add === 0n ? rustExpr : `(${rustExpr})`} >> ${shift}`;
        if (interType > toType) {
            rustExpr = `(${rustExpr}) as u${toType}`;
        }

        cExpr = fromType < interType ? `(uint${interType}_t)x` : `x`;
        cExpr += factor === 1n ? `` : ` * ${factor}`;
        cExpr += add === 0n ? `` : ` + ${add}`;
        cExpr = `${add === 0n ? cExpr : `(${cExpr})`} >> ${shift}`;
    }

    const commentLines = comment.split("\n");
    const needsAssert = inputRange !== 2 ** fromType - 1;

    const rustCode = [
        ...(!noComment ? commentLines.map((l) => "/// " + l) : []),
        `fn ${functionName}(x: u${fromType}) -> u${toType} {`,
        needsAssert ? `    debug_assert!(x <= ${inputRange});` : "",
        `    ${rustExpr}`,
        `}`,
    ]
        .filter(Boolean)
        .join("\n");

    const cCode = [
        ...(!noComment ? commentLines.map((l) => "// " + l) : []),
        `uint${toType}_t ${functionName}(uint${fromType}_t x) {`,
        needsAssert ? `    assert(x <= ${inputRange});` : "",
        `    return ${cExpr};`,
        `}`,
    ]
        .filter(Boolean)
        .join("\n");

    return { rust: rustCode, c: cCode };
}

export const ConversionCode = memo(
    ({
        solution,
        problem,
        ...options
    }: { solution: SolutionLike; problem: ProblemLike } & CodeGenOptions) => {
        const { rust, c } = generateCode(solution, problem, options);

        return (
            <>
                <CodeBlock code={rust} lang="rust" />
                <CodeBlock code={c} lang="c" />
            </>
        );
    },
);
