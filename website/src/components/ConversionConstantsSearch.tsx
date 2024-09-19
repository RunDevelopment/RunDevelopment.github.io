"use client";

import { memo, useEffect, useMemo, useState } from "react";
import { CodeBlock } from "./md/CodeBlock";
import { Conversion, Request, RoundingFunction } from "../lib/components/multiply-add-constants";
import { NumberInput, DownDown } from "./FormInputs";
import { findConversion, SearchResult } from "../lib/components/multiply-add-find";
import { InlineCode } from "./md/InlineCode";
import { getUnormConversion, MAX_KNOWN_CONVERSION } from "../lib/components/multiply-add-unorm";

export function ConversionConstantsSearch() {
    const [inputRange, setInputRange] = useState(31);
    const [from, setFrom] = useState(31);
    const [to, setTo] = useState(255);
    const [round, setRound] = useState<RoundingFunction>("round");
    const [linkedInputRange, setLinkedInputRange] = useState(true);
    const [optimizeAdd, setOptimizeAdd] = useState(false);
    const [moreShifts, setMoreShifts] = useState(0);

    useEffect(() => {
        if (linkedInputRange) {
            setFrom(inputRange);
        }
    }, [linkedInputRange, inputRange]);

    const [result, setResult] = useState<SearchResult>({
        conversion: { factor: 527, add: 23, shift: 6 },
        solutions: [{ factor: 527, add: [23, 23], shift: 6 }],
        request: { inputRange, R: round, D: from, T: to },
        time: 0,
    });
    useEffect(() => {
        findConversion(
            { inputRange, R: round, D: from, T: to },
            { optimizeAdd: optimizeAdd && round === "floor", fullShifts: moreShifts + 1 },
        ).then(setResult, (e) => console.error(e));
    }, [inputRange, from, to, round, optimizeAdd, moreShifts]);

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

        let formula;
        if (add === 0 && shift === 0) {
            formula = `x * ${factor}`;
        } else {
            const maxIntermediate = inputRange * factor + add;
            const interBits = Math.ceil(Math.log2(maxIntermediate));
            formula = `(x * ${factor} + ${add}) >> ${shift}  (${interBits} bits required)`;
        }

        result.solutions.sort((a, b) => {
            if (a.shift !== b.shift) return a.shift - b.shift;
            return a.factor - b.factor;
        });

        const text = [
            `Result: ${formula}`,
            `        f=${factor}, a=${add}, s=${shift}`,
            `        search took ${result.time}ms`,
            ``,
            `All found solutions:`,
            ...result.solutions.map((s, i) => {
                const differentShift = i > 0 && s.shift !== result.solutions[i - 1].shift;
                const a = s.add[0] === s.add[1] ? s.add[0] : s.add.join("-");
                return `${differentShift ? "\n" : ""}        s=${s.shift}, f=${s.factor}, a=${a}`;
            }),
        ].join("\n");

        return { text };
    }, [result]);

    const MAX = 2 ** 32 - 1;

    return (
        <>
            <pre className="narrow whitespace-pre-wrap">
                <div>
                    {">>> (U) Input range:  0 - "}
                    <NumberInput
                        min={1}
                        max={MAX}
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
                    {">>> (D) Divisor:          "}
                    <NumberInput
                        min={1}
                        max={MAX}
                        value={from}
                        readOnly={linkedInputRange}
                        onChange={setFrom}
                    />
                </div>
                <div>
                    {">>> (T) Denominator:      "}
                    <NumberInput min={1} max={MAX} value={to} onChange={setTo} />
                </div>
                <div>
                    {">>> (R) Rounding Fn:      "}
                    <DownDown
                        value={round}
                        onChange={setRound}
                        options={["round", "floor", "ceil"]}
                    />
                </div>
                {round === "floor" && false && (
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
                <div>
                    {">>> Additional Shift:     "}
                    <NumberInput min={0} max={8} value={moreShifts} onChange={setMoreShifts} />
                </div>
                {"\n" + resultContent.text}
            </pre>
            {result.conversion && (
                <ConversionCode request={result.request} conversion={result.conversion} />
            )}
        </>
    );
}

export function UnormConversion() {
    const [from, setFrom] = useState(5);
    const [to, setTo] = useState(8);

    const inputRange = 2 ** from - 1;
    const outputRange = 2 ** to - 1;

    const request: Request = { inputRange, R: "round", D: inputRange, T: outputRange };
    const conversion = getUnormConversion(from, to);

    return (
        <>
            <div className="narrow">
                <h6 className="mb-4 mt-10 text-lg font-bold">Unorm Conversion Tool:</h6>
                <div className="my-2">
                    <span className="mr-4 inline-block w-20 text-right">From</span>
                    <NumberInput
                        min={1}
                        max={MAX_KNOWN_CONVERSION}
                        value={from}
                        onChange={setFrom}
                    />
                    <span className="ml-1">{from === 1 ? "bit" : "bits"}</span>
                </div>
                <div className="my-2">
                    <span className="mr-4 inline-block w-20 text-right">To</span>
                    <NumberInput min={1} max={MAX_KNOWN_CONVERSION} value={to} onChange={setTo} />
                    <span className="ml-1">{to === 1 ? "bit" : "bits"}</span>
                </div>
                <div className="my-4">
                    <span className="mr-4 inline-block w-20 text-right">Constants</span>
                    <InlineCode
                        lang="json"
                        code={`f=${conversion.factor}, a=${conversion.add}, s=${conversion.shift}`}
                    />
                </div>
            </div>
            <ConversionCode
                conversion={conversion}
                request={request}
                functionName={`unorm${from}_to_unorm${to}`}
                comment={
                    `Converts a ${from}-bit unorm to a ${to}-bit unorm.\n` +
                    `This is equivalent to \`round(x * ${outputRange} / ${inputRange})\`.`
                }
            />
        </>
    );
}

interface Bits {
    input: number;
    output: number;
    intermediate: number;
}
function getRequiredBits(conversion: Conversion, request: Request): Bits {
    const { factor, add } = conversion;
    const { inputRange, T, D, R } = request;

    const outputRange = Math[R]((inputRange * T) / D);
    const maxIntermediate = inputRange * factor + add;

    return {
        input: Math.ceil(Math.log2(inputRange + 1)),
        output: Math.ceil(Math.log2(outputRange + 1)),
        intermediate: Math.ceil(Math.log2(maxIntermediate + 1)),
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
    conversion: Conversion,
    request: Request,
    options?: CodeGenOptions,
): GeneratedCode {
    const { factor, add, shift } = conversion;
    const { inputRange, T, D, R } = request;
    const outputRange = Math.floor((factor * inputRange + add) / 2 ** shift);

    const roundingComment: Record<RoundingFunction, string> = {
        round: "rounding",
        floor: "rounding down",
        ceil: "rounding up",
    };
    const bitsToTypeSize = (bits: number) => Math.max(8, 2 ** Math.ceil(Math.log2(bits)));
    const bits = getRequiredBits(conversion, request);

    const fromType = bitsToTypeSize(bits.input);
    const toType = bitsToTypeSize(bits.output);

    const {
        noComment,
        comment = `Converts a value 0..=${inputRange} to 0..=${outputRange}\nby multiplying with ${T}/${D} and then ${roundingComment[R]}.`,
        functionName = "convert_range",
    } = options || {};

    let rustExpr, cExpr;
    if (add === 0 && shift === 0) {
        rustExpr = fromType < toType ? `x as u${toType}` : `x`;
        rustExpr += factor === 1 ? `` : ` * ${factor}`;

        cExpr = fromType < toType ? `(uint${toType}_t)x` : `x`;
        cExpr += factor === 1 ? `` : ` * ${factor}`;
    } else {
        const interType = bitsToTypeSize(bits.intermediate);

        rustExpr = fromType < interType ? `x as u${interType}` : `x`;
        rustExpr += factor === 1 ? `` : ` * ${factor}`;
        rustExpr += add === 0 ? `` : ` + ${add}`;
        rustExpr = `${add === 0 ? rustExpr : `(${rustExpr})`} >> ${shift}`;
        if (interType > toType) {
            rustExpr = `(${rustExpr}) as u${toType}`;
        }

        cExpr = fromType < interType ? `(uint${interType}_t)x` : `x`;
        cExpr += factor === 1 ? `` : ` * ${factor}`;
        cExpr += add === 0 ? `` : ` + ${add}`;
        cExpr = `${add === 0 ? cExpr : `(${cExpr})`} >> ${shift}`;
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

const ConversionCode = memo(
    ({
        conversion,
        request,
        ...options
    }: { conversion: Conversion; request: Request } & CodeGenOptions) => {
        const { rust, c } = generateCode(conversion, request, options);

        return (
            <>
                <CodeBlock code={rust} lang="rust" />
                <CodeBlock code={c} lang="c" />
            </>
        );
    },
);
