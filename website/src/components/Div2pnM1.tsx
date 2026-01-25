"use client";

import { useState } from "react";
import { CodeBlock } from "./md/CodeBlock";
import { DownDown, NumberInput, SmallCheckbox } from "./FormInputs";
import { capitalize } from "../lib/util";

type RoundingMode = "round" | "floor" | "ceil";
type OrVariable<T> = T | "variable";

export function Div2pnM1() {
    const [n, setN] = useState<OrVariable<number>>("variable");
    const [i, setI] = useState<OrVariable<number>>(2);
    const [rounding, setRounding] = useState<OrVariable<RoundingMode>>("round");
    const [bitWidth, setBitWidth] = useState<number>(32);

    return (
        <>
            <p>
                <VariableOption
                    value={n}
                    setValue={setN}
                    defaultValue={10}
                    label="n"
                    renderValue={(value, setValue, disable) => (
                        <NumberInput
                            value={value}
                            onChange={setValue}
                            min={1}
                            max={64}
                            readOnly={disable}
                            className="w-full"
                        />
                    )}
                />
                <VariableOption
                    value={i}
                    setValue={setI}
                    defaultValue={2}
                    label={
                        <>
                            <span className="hidden xs:inline">Iteration count</span>
                            <span className="inline xs:hidden">Iterations</span>
                        </>
                    }
                    renderValue={(value, setValue, disable) => (
                        <NumberInput
                            value={value}
                            onChange={setValue}
                            min={1}
                            max={8}
                            readOnly={disable}
                            className="w-full"
                        />
                    )}
                />
                <VariableOption
                    value={rounding}
                    setValue={setRounding}
                    defaultValue={"round" as RoundingMode}
                    label={
                        <>
                            Rounding<span className="hidden xs:inline"> mode</span>
                        </>
                    }
                    renderValue={(value, setValue, disable) => (
                        <DownDown
                            value={value}
                            onChange={setValue}
                            options={["floor", "round", "ceil"]}
                            getLabel={capitalize}
                            disabled={disable}
                            className="w-full"
                        />
                    )}
                />
                <ViewThree
                    label={
                        <>
                            Int<span className="hidden xs:inline">eger</span> type
                        </>
                    }
                    input={
                        <DownDown
                            value={String(bitWidth)}
                            onChange={(value) => setBitWidth(Number(value))}
                            options={["8", "16", "32", "64", "128"]}
                            getLabel={(o) => `u${o}`}
                            className="w-full"
                        />
                    }
                />
            </p>
            <CodeBlock code={generateCode(n, i, rounding, bitWidth)} lang="rust" />
        </>
    );
}

type VariableOptionProps<T, S extends (value: OrVariable<T>) => void> = {
    value: OrVariable<T>;
    setValue: S;
    defaultValue: T;
    label: React.ReactNode;
    renderValue: (value: T, setValue: (value: T) => void, disable: boolean) => React.ReactNode;
};
function VariableOption<T, S extends (value: OrVariable<T>) => void>({
    value,
    setValue,
    defaultValue,
    label,
    renderValue,
}: VariableOptionProps<T, S>) {
    const [lastNonVar, setLastNonVar] = useState<T>(defaultValue);

    const nonVar = value === "variable" ? lastNonVar : value;

    return (
        <ViewThree
            label={label}
            input={renderValue(
                nonVar,
                (newValue) => {
                    setLastNonVar(newValue);
                    setValue(newValue);
                },
                value === "variable",
            )}
            other={
                <SmallCheckbox
                    checked={value === "variable"}
                    onChange={(checked) => {
                        if (checked) {
                            setValue("variable");
                        } else {
                            setValue(nonVar);
                        }
                    }}
                    text={
                        <>
                            Param<span className="hidden xs:inline">eter</span>
                        </>
                    }
                />
            }
        />
    );
}
type ViewThreeProps = {
    label: React.ReactNode;
    input: React.ReactNode;
    other?: React.ReactNode;
};
function ViewThree({ label, input, other }: ViewThreeProps) {
    return (
        <span className="my-2 flex items-center gap-2 sm:max-w-96">
            <span className="w-16 shrink-0 text-right xs:w-32">{label}:</span>
            <span className="grow">{input}</span>
            <span className="w-20 xs:w-32">{other}</span>
        </span>
    );
}

function generateCode(
    n: OrVariable<number>,
    i: OrVariable<number>,
    rounding: OrVariable<RoundingMode>,
    bitWidth: number = 32,
): string {
    const ty = `u${bitWidth}`;
    const nValue = n === "variable" ? "n" : n;

    let code = "";

    // docs
    const roundingWorst = rounding === "variable" ? "ceil" : rounding;
    const docDiv = n === "variable" ? "(2^n - 1)" : (2n ** BigInt(n) - 1n).toString();
    if (rounding === "variable") {
        code += "/// Returns `v / " + docDiv + "` rounded with the given rounding mode.\n";
    } else {
        code += "/// Returns `" + rounding + "(v / " + docDiv + ")`.\n";
    }
    code += "///\n";

    code += "/// Returned values are correct if both:\n";

    code += "/// 1. the approximation is exact: v < ";
    const docsApproxRoundValue: Record<RoundingMode, string> = {
        floor: n === "variable" ? " + 2^n - 2" : " + " + (2n ** BigInt(n) - 2n).toString(),
        round:
            n === "variable" ? " + 2^(n-1) - 1" : " + " + (2n ** (BigInt(n) - 1n) - 1n).toString(),
        ceil: "",
    };
    if (i === "variable") {
        code += "2^(i*" + nValue + ")" + docsApproxRoundValue[roundingWorst] + "\n";
    } else {
        const mul = n === "variable" ? (i === 1 ? "n" : "(" + i + "n)") : i * n;
        code += "2^" + mul + docsApproxRoundValue[roundingWorst];
        if (n !== "variable") {
            const roundValue: Record<RoundingMode, bigint> = {
                floor: 2n ** BigInt(n) - 2n,
                round: 2n ** (BigInt(n) - 1n) - 1n,
                ceil: 0n,
            };
            const until = 2n ** BigInt(mul) + roundValue[roundingWorst];
            code += " = " + until.toString();
        }
        code += "\n";
    }

    code += "/// 2. no overflow occurs:         v < ";
    if (n === "variable") {
        const roundValue: Record<RoundingMode, string> = {
            floor: "1",
            round: "2^(n-1)",
            ceil: "2^n+1",
        };
        code +=
            "2^" +
            bitWidth +
            " - " +
            roundValue[roundingWorst] +
            " - " +
            roundingWorst +
            "(v/(2^n-1)).\n";
    } else {
        const roundValue: Record<RoundingMode, bigint> = {
            floor: 1n,
            round: 2n ** (BigInt(n) - 1n),
            ceil: 2n ** BigInt(n) - 1n,
        };
        const maxVP1 =
            getMaxVFittingBitWidth(
                bitWidth,
                rounding === "variable" ? roundValue.ceil : roundValue[rounding],
                BigInt(n),
                i === "variable" ? 32 : i,
            ) + 1n;
        code += "2^" + bitWidth + " - " + (2n ** BigInt(bitWidth) - maxVP1) + " = " + maxVP1 + "\n";
    }

    // function signature
    code += "fn ";
    code += "div_";
    if (rounding !== "variable") {
        code += rounding + "_";
    }
    code += "by_";
    code += n === "variable" ? "2pn_m1" : 2n ** BigInt(n) - 1n;
    code += "(v: " + ty;
    if (n === "variable") {
        code += `, n: ${ty}`;
    }
    if (i === "variable") {
        code += `, i: u8`;
    }
    if (rounding === "variable") {
        code += `, mode: RoundingMode`;
    }
    code += ") -> " + ty + " {\n";

    // function body

    // asserts
    if (n === "variable") {
        code += '    debug_assert!(n != 0, "Division by zero");\n';
    }

    // rounding
    const roundValue: Record<RoundingMode, string | number | bigint> = {
        floor: "1",
        round: n === "variable" ? "(1 << (n - 1))" : 2n ** (BigInt(n) - 1n),
        ceil: n === "variable" ? "(1 << n) - 1" : 2n ** BigInt(n) - 1n,
    };
    let roundExpr;
    if (rounding === "variable") {
        let round = String(roundValue.round);
        if (n === "variable") {
            round = round.slice(1, -1); // remove parentheses
        }

        code += "    let round = ";
        code += "match mode {\n";
        code += "        RoundingMode::Floor => " + roundValue.floor + ",\n";
        code += "        RoundingMode::Round => " + round + ",\n";
        code += "        RoundingMode::Ceil => " + roundValue.ceil + ",\n";
        code += "    }";
        code += ";\n";
        roundExpr = "round";
    } else {
        roundExpr = roundValue[rounding];
    }

    // starting calculation
    code += "    let w = v + " + roundExpr + ";\n";

    // iterations
    if (i === 1) {
        code += "    w >> " + nValue + "\n";
    } else if (i === 2) {
        code += "    ((w >> " + nValue + ") + w) >> " + nValue + "\n";
    } else {
        code += "    let mut r = w >> " + nValue + ";\n";
        if (i === "variable") {
            code += "    for _ in 1..i {\n";
            code += "        r = (r + w) >> " + nValue + ";\n";
            code += "    }\n";
        } else {
            for (let iter = 1; iter < i; iter++) {
                code += "    r = (r + w) >> " + nValue + ";\n";
            }
        }
        code += "    r\n";
    }

    code += "}\n";

    // enum for variable rounding
    if (rounding === "variable") {
        code += `\nenum RoundingMode {
    Floor,
    Round,
    Ceil,
}\n`;
    }

    return code;
}
function getMaxVFittingBitWidth(bitWidth: number, round: bigint, n: bigint, i: number): bigint {
    const getMaxIntermediate = (v: bigint): bigint => {
        const w = v + round;
        let max = w;
        let r = w >> n;
        for (let iter = 1; iter < i; iter++) {
            const inter = r + w;
            if (inter > max) {
                max = inter;
            }
            r = inter >> n;
        }
        return max;
    };

    // find the v with the max intermediate that still fits in bitWidth using binary search
    const max = 2n ** BigInt(bitWidth) - 1n;
    let best = -1n;
    let low = 0n;
    let high = max + 1n;
    while (low < high) {
        const mid = (low + high) >> 1n;
        const inter = getMaxIntermediate(mid);
        if (inter <= max) {
            best = mid;
            low = mid + 1n;
        } else {
            high = mid;
        }
    }
    return best;
}
