"use client";

import { useState } from "react";
import { ProblemLike } from "./interfaces";
import { NumberInput } from "../FormInputs";
import { InlineCode } from "../md/InlineCode";
import { ConversionCode, getIntermediateTypeSize } from "./CodeGen";
import { SolutionLike } from "./interfaces";
import precomputed from "./unorm-constants.json";

const MAX_KNOWN_CONVERSION = Math.sqrt(precomputed.length);

function getUnormConversion(from: number, to: number): SolutionLike {
    if (from <= MAX_KNOWN_CONVERSION && to <= MAX_KNOWN_CONVERSION) {
        return parseConversion(precomputed[(from - 1) * MAX_KNOWN_CONVERSION + (to - 1)]);
    }
    throw new Error(`No UNORM conversion data for ${from} -> ${to}`);
}

function parseConversion(s: string): SolutionLike {
    const [factor, add, shift] = s.split(",");
    return { factor: BigInt(factor), add: BigInt(add), shift: Number(shift) };
}

function optimizeSolution(inputRange: number, solution: SolutionLike): SolutionLike {
    const { factor, add, shift } = solution;

    if (shift === 0 || shift === 8 || shift === 16 || shift === 32 || shift === 64) {
        // shift is already optimal
        return solution;
    }
    if (shift > 32) {
        // shift is too large already
        return solution;
    }

    const preferredShift = 2 ** Math.ceil(Math.log2(shift));
    const shiftDiff = BigInt(preferredShift - shift);
    const preferred: SolutionLike = {
        factor: factor << shiftDiff,
        add: add << shiftDiff,
        shift: preferredShift,
    };

    if (
        getIntermediateTypeSize(inputRange, solution) ===
        getIntermediateTypeSize(inputRange, preferred)
    ) {
        return preferred;
    }

    return solution; // no optimization possible
}

export function UnormConversion() {
    const [from, setFrom] = useState(5);
    const [to, setTo] = useState(8);

    const inputRange = 2 ** from - 1;
    const outputRange = 2 ** to - 1;

    const problem: ProblemLike = { inputRange, rounding: "round", d: inputRange, t: outputRange };
    const solution = optimizeSolution(inputRange, getUnormConversion(from, to));

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
                        code={`f=${solution.factor}, a=${solution.add}, s=${solution.shift}`}
                    />
                </div>
            </div>
            <ConversionCode
                solution={solution}
                problem={problem}
                functionName={`unorm${from}_to_unorm${to}`}
                comment={
                    `Converts a ${from}-bit unorm to a ${to}-bit unorm.\n` +
                    `This is equivalent to \`round(x * ${outputRange} / ${inputRange})\`.`
                }
            />
        </>
    );
}
