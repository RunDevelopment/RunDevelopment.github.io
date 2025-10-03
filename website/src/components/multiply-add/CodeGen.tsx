import { memo } from "react";
import { CodeBlock } from "../md/CodeBlock";
import { Problem, RoundingMode, Solution, Bits } from "./multiply-add-solver";

interface CodeGenParams {
    solution: Solution;
    problem: Problem;
    rounding: RoundingMode;
    comment?: string;
    noComment?: boolean;
    functionName?: string;
}
interface GeneratedCode {
    rust: string;
    c: string;
}
function generateCode(params: CodeGenParams): GeneratedCode {
    const { f, a, s } = params.solution;
    const { u, t: t, d: d } = params.problem;
    const outputRange = (u * f + a) >> BigInt(s);

    const roundingComment: Record<RoundingMode, string> = {
        round: "rounding",
        floor: "rounding down",
        ceil: "rounding up",
    };
    const bits = params.solution.requiredBits(u);

    const fromType = Bits.typeSize(bits.input);
    const toType = Bits.typeSize(bits.output);

    const {
        noComment,
        comment = `Converts a value 0..=${u} to 0..=${outputRange}\nby multiplying with ${t}/${d} and then ${roundingComment[params.rounding]}.`,
        functionName = "convert_range",
    } = params;

    let rustExpr, cExpr;
    if (a === 0n && s === 0n) {
        rustExpr = fromType < toType ? `x as u${toType}` : `x`;
        rustExpr += f === 1n ? `` : ` * ${f}`;

        cExpr = fromType < toType ? `(uint${toType}_t)x` : `x`;
        cExpr += f === 1n ? `` : ` * ${f}`;
    } else {
        const interType = Bits.typeSize(bits.intermediate);

        rustExpr = fromType < interType ? `x as u${interType}` : `x`;
        rustExpr += f === 1n ? `` : ` * ${f}`;
        rustExpr += a === 0n ? `` : ` + ${a}`;
        rustExpr = `${a === 0n ? rustExpr : `(${rustExpr})`} >> ${s}`;
        if (interType > toType) {
            rustExpr = `(${rustExpr}) as u${toType}`;
        }

        cExpr = fromType < interType ? `(uint${interType}_t)x` : `x`;
        cExpr += f === 1n ? `` : ` * ${f}`;
        cExpr += a === 0n ? `` : ` + ${a}`;
        cExpr = `${a === 0n ? cExpr : `(${cExpr})`} >> ${s}`;
    }

    const commentLines = comment.split("\n");
    const needsAssert = u !== 2n ** BigInt(fromType) - 1n;

    const rustCode = [
        ...(!noComment ? commentLines.map((l) => "/// " + l) : []),
        `fn ${functionName}(x: u${fromType}) -> u${toType} {`,
        needsAssert ? `    debug_assert!(x <= ${u});` : "",
        `    ${rustExpr}`,
        `}`,
    ]
        .filter(Boolean)
        .join("\n");

    const cCode = [
        ...(!noComment ? commentLines.map((l) => "// " + l) : []),
        `uint${toType}_t ${functionName}(uint${fromType}_t x) {`,
        needsAssert ? `    assert(x <= ${u});` : "",
        `    return ${cExpr};`,
        `}`,
    ]
        .filter(Boolean)
        .join("\n");

    return { rust: rustCode, c: cCode };
}

export const ConversionCode = memo((params: CodeGenParams) => {
    const { rust, c } = generateCode(params);

    return (
        <>
            <CodeBlock code={rust} lang="rust" />
            <CodeBlock code={c} lang="c" />
        </>
    );
});
