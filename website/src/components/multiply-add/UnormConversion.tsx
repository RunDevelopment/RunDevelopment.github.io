"use client";

import { useState } from "react";
import { NumberInput } from "../FormInputs";
import { InlineCode } from "../md/InlineCode";
import { ConversionCode } from "./CodeGen";
import precomputed from "./unorm-constants.json";
import { Problem, Solution } from "./multiply-add-solver";

const MAX_KNOWN_CONVERSION = Math.sqrt(precomputed.length);

function getUnormConversion(from: number, to: number): Solution {
    if (from <= MAX_KNOWN_CONVERSION && to <= MAX_KNOWN_CONVERSION) {
        return parseConversion(precomputed[(from - 1) * MAX_KNOWN_CONVERSION + (to - 1)]);
    }
    throw new Error(`No UNORM conversion data for ${from} -> ${to}`);
}

function parseConversion(s: string): Solution {
    const [factor, add, shift] = s.split(",");
    return new Solution(BigInt(factor), BigInt(add), BigInt(shift));
}

export function UnormConversion() {
    const [from, setFrom] = useState(5);
    const [to, setTo] = useState(8);

    const inputRange = (1n << BigInt(from)) - 1n;
    const outputRange = (1n << BigInt(to)) - 1n;

    const problem = Problem.round(inputRange, outputRange, inputRange);
    const solution = getUnormConversion(from, to).optimize(inputRange);

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
                        code={`f=${solution.f}, a=${solution.a}, s=${solution.s}`}
                    />
                </div>
            </div>
            <ConversionCode
                solution={solution}
                problem={problem}
                rounding="round"
                functionName={`unorm${from}_to_unorm${to}`}
                comment={
                    `Converts a ${from}-bit unorm to a ${to}-bit unorm.\n` +
                    `This is equivalent to \`round(x * ${outputRange} / ${inputRange})\`.`
                }
            />
        </>
    );
}
