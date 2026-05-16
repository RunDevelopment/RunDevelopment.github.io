"use client";

import React, { useState } from "react";
import ScreenCanvas, { CanvasInfo } from "../ScreenCanvas";
import { ButtonGroup, NumberInput, SmallButton, SmallCheckbox } from "../FormInputs";
import { GiDiceSixFacesFive } from "react-icons/gi";
import { BiReset } from "react-icons/bi";
import { useMatchesMedia } from "../../hooks/useMatchesMedia";
import { PRESETS } from "./presets";
import {
    Kernel,
    kernelAreaLineSampling,
    kernelAreaPointSampling,
    kernelRot90,
    rotateForHorizontalLineSampling,
    shouldRotateHeuristicCPD,
} from "./kernel";

type SampleAlgo = ["point", number] | ["line", number];

export default function KernelVisualization({
    showApproximations = false,
    showAbcd = false,
    readonly = false,
    applyThreshold: initialApplyThreshold = false,
    initial,
}: {
    showApproximations?: boolean;
    showAbcd?: boolean;
    readonly?: boolean;
    applyThreshold?: boolean;
    initial?: Partial<Kernel>;
}) {
    const [v00, setV00] = useState(initial?.v00 ?? 0.0);
    const [v10, setV10] = useState(initial?.v10 ?? 0.33);
    const [v01, setV01] = useState(initial?.v01 ?? 0.72);
    const [v11, setV11] = useState(initial?.v11 ?? 0.59);
    const [t, setT] = useState(initial?.t ?? 0.5);
    const [applyThreshold, setApplyThreshold] = useState(initialApplyThreshold);

    const kernel: Kernel = { v00, v10, v01, v11, t };

    const cpdHeuristic = shouldRotateHeuristicCPD(kernel);
    const rotKernel = cpdHeuristic ? kernelRot90(kernel) : kernel;
    const exactArea = kernelAreaLineSampling(rotKernel, 256);

    const [sampleAlgo, setSampleAlgo] = useState<SampleAlgo | undefined>();
    const [peekSampleAlgo, setPeekSampleAlgo] = useState<SampleAlgo | undefined>();

    const hasMousePointer = useMatchesMedia("(pointer: fine) and (hover: hover)", false);

    return (
        <div className="narrow">
            <div className="grid grid-cols-2 sm:gap-y-2 gap-x-4 mt-4 mb-2">
                <VInput v={v00} setV={setV00} label="v(0,0)" readonly={readonly} />
                <VInput v={v10} setV={setV10} label="v(1,0)" readonly={readonly} />
                <VInput v={v01} setV={setV01} label="v(0,1)" readonly={readonly} />
                <VInput v={v11} setV={setV11} label="v(1,1)" readonly={readonly} />
                <VInput v={t} setV={setT} label="t" readonly={readonly} />
                <div className="flex items-center pt-4 sm:pt-0">
                    <SmallCheckbox
                        checked={applyThreshold}
                        onChange={setApplyThreshold}
                        text="Apply Threshold"
                    />
                </div>
            </div>
            {showAbcd && <AbcdDisplay kernel={kernel} />}

            <div className="flex gap-x-2 justify-center -mx-2">
                <div className="w-[400px] max-w-full">
                    <ScreenCanvas
                        className="w-full aspect-square"
                        render={(ctx, info) => {
                            const image = ctx.createImageData(info.pixelWidth, info.pixelHeight);
                            // const start = performance.now();
                            if (applyThreshold) {
                                drawKernelThresholded(image, kernel);
                            } else {
                                drawKernel(image, kernel);
                            }
                            // console.log("Render time:", performance.now() - start, "ms");
                            ctx.putImageData(image, 0, 0);

                            const activeSampleAlgo =
                                sampleAlgo ?? (hasMousePointer ? peekSampleAlgo : undefined);
                            if (activeSampleAlgo) {
                                const [algo, n] = activeSampleAlgo;
                                if (algo === "point") {
                                    drawSampleGrid(ctx, info, kernel, n);
                                } else {
                                    drawSampleLines(ctx, info, kernel, cpdHeuristic, n);
                                }
                            }
                        }}
                    />
                    <div className="text-center my-2">
                        Area above threshold:{" "}
                        <span className="font-mono whitespace-pre font-bold">
                            {formatArea(exactArea).padStart(7)}
                        </span>
                    </div>
                </div>
                {!readonly && (
                    <div className="w-min flex-shrink-0">
                        {initial && (
                            <SmallButton
                                title="Reset to default"
                                className="mb-2"
                                onClick={() => {
                                    setV00((old) => initial.v00 ?? old);
                                    setV10((old) => initial.v10 ?? old);
                                    setV01((old) => initial.v01 ?? old);
                                    setV11((old) => initial.v11 ?? old);
                                    setT((old) => initial.t ?? old);
                                    setApplyThreshold(initialApplyThreshold);
                                }}
                            >
                                <BiReset size={16} className="inline-block" />
                            </SmallButton>
                        )}
                        <ButtonGroup className="mb-2 w-min inline-block" vertical>
                            {PRESETS.map(({ icon: text, title, kernel: presetKernel }, i) => (
                                <SmallButton
                                    key={i}
                                    title={"Preset: " + title}
                                    selected={
                                        v00 === presetKernel.v00 &&
                                        v10 === presetKernel.v10 &&
                                        v01 === presetKernel.v01 &&
                                        v11 === presetKernel.v11 &&
                                        t === presetKernel.t
                                    }
                                    onClick={() => {
                                        setV00(presetKernel.v00);
                                        setV10(presetKernel.v10);
                                        setV01(presetKernel.v01);
                                        setV11(presetKernel.v11);
                                        setT(presetKernel.t);
                                    }}
                                >
                                    {text}
                                </SmallButton>
                            ))}
                        </ButtonGroup>
                        <SmallButton
                            title="Random"
                            onClick={() => {
                                const r = (min = 0, max = 100) =>
                                    Math.floor(Math.random() * (max - min + 1) + min);
                                const v = [r(), r(), r(), r()];
                                const t = r(Math.min(...v), Math.max(...v)) / 100;
                                const [v00, v10, v01, v11] = v.map((x) => x / 100);

                                setV00(v00);
                                setV10(v10);
                                setV01(v01);
                                setV11(v11);
                                setT(t);
                            }}
                        >
                            <GiDiceSixFacesFive size={16} className="inline-block" />
                        </SmallButton>
                    </div>
                )}
            </div>

            {showApproximations && (
                <KernelEval
                    kernel={kernel}
                    exact={exactArea}
                    sampleAlgo={sampleAlgo}
                    setSampleAlgo={setSampleAlgo}
                    setPeekSampleAlgo={setPeekSampleAlgo}
                />
            )}
        </div>
    );
}

function VInput({
    v,
    setV,
    label,
    readonly,
}: {
    v: number;
    setV: (v: number) => void;
    label: string;
    readonly?: boolean;
}) {
    v = Math.round(v * 100);

    if (readonly) {
        return (
            <span>
                <span className="font-serif text-right inline-block italic mr-1 w-14 whitespace-nowrap">
                    {label + " = "}
                </span>
                {v}
            </span>
        );
    }

    const id = `input-${label.trim()}`;
    return (
        <label htmlFor={id} className="flex items-center flex-wrap sm:flex-nowrap">
            <span className="font-serif sm:text-right italic mr-1 w-full sm:w-14 whitespace-nowrap -mb-2 sm:mb-0 -z-10">
                {label + " = "}
            </span>
            <NumberInput
                className="pr-0 sm:pr-1 order-2 sm:order-1"
                id={id}
                readOnly={readonly}
                min={0}
                max={100}
                value={v}
                onChange={(value) => setV(value / 100)}
            />
            <input
                className="mr-1 sm:ml-1 flex-grow py-2 basis-0 min-w-0 order-1 sm:order-2"
                type="range"
                min={0}
                max={100}
                size={0}
                step={1}
                value={v}
                onChange={(e) => setV(parseFloat(e.target.value) / 100)}
                disabled={readonly}
            />
        </label>
    );
}

function AbcdDisplay({ kernel }: { kernel: Kernel }) {
    // make all kernel values integers
    const [v00, v10, v01, v11, t] = [kernel.v00, kernel.v10, kernel.v01, kernel.v11, kernel.t].map(
        (x) => Math.round(x * 100),
    );

    const a = v11 - v10 - v01 + v00;
    const b = v10 - v00;
    const c = v01 - v00;
    const d = v00 - t;

    const p = b / a;
    const q = (b * c - a * d) / (a * a);

    function formatNumber(x: number) {
        if (Number.isNaN(x)) return "undef";
        if (x === Infinity) return "∞";
        if (x === -Infinity) return "-∞";

        const abs = Math.abs(x);
        if (abs < 1e-12) return "0";
        if (abs < 1e-4) return x.toExponential(6);
        if (abs < 1 && abs > 1e-4) return x.toFixed(7).replace(/\.0+$|(\.\d+?)0+$/, "$1");
        return x.toPrecision(6).replace(/(\.\d+?)0+$/, "$1");
    }

    return (
        <div className="text-center my-2 font-serif">
            <span className="inline-block w-16">a = {String(a)}</span>
            <span className="inline-block w-16">b = {String(b)}</span>
            <span className="inline-block w-16">c = {String(c)}</span>
            <span className="inline-block w-16">d = {String(d)}</span>
            <br />
            <span className="inline-block w-32">p = {formatNumber(p)}</span>
            <span className="inline-block w-32">q = {formatNumber(q)}</span>
            <br />
            <span className="inline-block w-64">pole at x = {formatNumber(-c / a)}</span>
        </div>
    );
}

function KernelEval({
    kernel,
    exact,
    sampleAlgo,
    setSampleAlgo,
    setPeekSampleAlgo,
}: {
    kernel: Kernel;
    exact: number;
    sampleAlgo?: SampleAlgo;
    setSampleAlgo: (also: SampleAlgo | undefined) => void;
    setPeekSampleAlgo: (also: SampleAlgo | undefined) => void;
}) {
    const rotKernel = rotateForHorizontalLineSampling(kernel);

    const toggleSampleAlgo = (algo: SampleAlgo) => {
        if (sampleAlgo && sampleAlgo[0] === algo[0] && sampleAlgo[1] === algo[1]) {
            setSampleAlgo(undefined);
        } else {
            setSampleAlgo(algo);
        }
    };

    const selectedIndex = sampleAlgo && Math.round(Math.log2(sampleAlgo[1]));

    return (
        <div className="flex gap-x-4 sm:gap-x-12 gap-y-2 justify-center flex-wrap -mx-2">
            <div>
                Point samples (grid):
                <AreaResultsTable
                    exact={exact}
                    labels={["1×1", "2×2", "4×4", "8×8", "16×16"]}
                    approx={[
                        kernelAreaPointSampling(rotKernel, 1),
                        kernelAreaPointSampling(rotKernel, 2),
                        kernelAreaPointSampling(rotKernel, 4),
                        kernelAreaPointSampling(rotKernel, 8),
                        kernelAreaPointSampling(rotKernel, 16),
                    ]}
                    selectedIndex={sampleAlgo?.[0] === "point" ? selectedIndex : undefined}
                    onMouseEnter={(index) => setPeekSampleAlgo(["point", 2 ** index])}
                    onMouseLeave={() => setPeekSampleAlgo(undefined)}
                    onClick={(index) => toggleSampleAlgo(["point", 2 ** index])}
                />
            </div>
            <div>
                Line samples (CPD):
                <AreaResultsTable
                    exact={exact}
                    labels={["1", "2", "4", "8", "16"]}
                    approx={[
                        kernelAreaLineSampling(rotKernel, 1),
                        kernelAreaLineSampling(rotKernel, 2),
                        kernelAreaLineSampling(rotKernel, 4),
                        kernelAreaLineSampling(rotKernel, 8),
                        kernelAreaLineSampling(rotKernel, 16),
                    ]}
                    selectedIndex={sampleAlgo?.[0] === "line" ? selectedIndex : undefined}
                    onMouseEnter={(index) => setPeekSampleAlgo(["line", 2 ** index])}
                    onMouseLeave={() => setPeekSampleAlgo(undefined)}
                    onClick={(index) => toggleSampleAlgo(["line", 2 ** index])}
                />
            </div>
        </div>
    );
}
function AreaResultsTable({
    exact,
    approx,
    labels,
    selectedIndex,
    onMouseEnter,
    onMouseLeave,
    onClick,
}: {
    exact: number;
    approx: number[];
    labels: string[];
    selectedIndex?: number;
    onMouseEnter: (index: number) => void;
    onMouseLeave: (index: number) => void;
    onClick: (index: number) => void;
}) {
    return (
        <table>
            <tbody>
                {labels.map((label, index) => {
                    const selected = selectedIndex === index;
                    return (
                        <tr
                            key={index}
                            className={
                                "leading-tight cursor-pointer hover:bg-black relative outline-1 text-sm xs:[font-size:inherit] mb-1 sm:mb-0 " +
                                (selected ? "bg-black text-white font-bold outline" : "")
                            }
                            onMouseEnter={() => onMouseEnter(index)}
                            onMouseLeave={() => onMouseLeave(index)}
                            onClick={() => onClick(index)}
                        >
                            <td className="text-right pr-2">{label}</td>
                            <td>
                                <AreaComparisonLabel exact={exact} approx={approx[index]} />
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
function AreaComparisonLabel({ exact, approx }: { exact: number; approx: number }) {
    const diffNum = (approx - exact) * 100;
    const diffMag = Math.abs(diffNum);
    const diff =
        diffMag < 0.005
            ? "± 0.00%"
            : (diffNum > 0 ? "+" : "-") + diffMag.toFixed(2).padStart(5) + "%";

    let diffColor;
    if (diffMag < 0.1) {
        diffColor = "text-emerald-200";
    } else if (diffMag <= 1) {
        diffColor = "text-green-400";
    } else if (diffMag <= 5) {
        diffColor = "text-lime-300";
    } else if (diffMag <= 10) {
        diffColor = "text-yellow-300";
    } else if (diffMag <= 25) {
        diffColor = "text-orange-400";
    } else {
        diffColor = "text-red-500";
    }

    const transfer = (x: number, offset = 10) => Math.log(x + offset) - Math.log(offset);

    return (
        <span className="pb-1 inline-block sm:pb-0 whitespace-pre font-mono">
            {formatArea(approx).padStart(7)}
            <span className={"sm:relative ml-2 sm:ml-0 " + diffColor}>
                <span className="hidden sm:inline-block w-16 h-3 mx-1 relative">
                    <span
                        className="h-full block bg-current right-0 absolute"
                        style={{
                            width: `${Math.min(100, (transfer(diffMag) / transfer(50)) * 100)}%`,
                        }}
                    />
                </span>

                <span
                    className="h-1 block sm:hidden bg-current right-0 absolute"
                    style={{
                        width: `${Math.min(100, (transfer(diffMag) / transfer(50)) * 100)}%`,
                    }}
                />
                {diff}
            </span>
        </span>
    );
}
function formatArea(area: number) {
    return (area * 100).toFixed(2) + "%";
}

function drawKernel(image: ImageData, kernel: Kernel) {
    const w = image.width;
    const h = image.height;

    const { v00, v10, v01, v11, t } = kernel;

    const a = v11 - v10 - v01 + v00;
    const b = v10 - v00;
    const c = v01 - v00;
    const d = v00;

    const distances = new DistanceCache(w, h, kernel);

    const LINE_THICKNESS = Math.max(2, image.width * 0.005);
    const lerp_srgb = (blend: number, c0: number, c1: number) => {
        return Math.sqrt(c1 * c1 * blend + c0 * c0 * (1 - blend));
    };

    const BAYER_4x4 = [
        0 / 16,
        8 / 16,
        2 / 16,
        10 / 16,
        12 / 16,
        4 / 16,
        14 / 16,
        6 / 16,
        3 / 16,
        11 / 16,
        1 / 16,
        9 / 16,
        15 / 16,
        7 / 16,
        13 / 16,
        5 / 16,
    ];

    // draw interpolated values and line
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const dither = Math.random(); // random dithering
            // const dither = 0.5; // no dithering
            // const dither = BAYER_4x4[(y % 4) * 4 + (x % 4)]; // ordered dithering 4x4

            const u = x / (w - 1);
            const v = y / (h - 1);
            const value = a * u * v + b * u + c * v + d;
            const color = value * 255 + dither;
            const index = (y * w + x) * 4;
            image.data[index] = color;
            image.data[index + 1] = color;
            image.data[index + 2] = color;
            image.data[index + 3] = 255;

            const dist = distances.dist(x, y) * image.width;
            if (dist < LINE_THICKNESS) {
                const blend = Math.min(1, LINE_THICKNESS - dist);
                image.data[index] = lerp_srgb(blend, color, 255);
                image.data[index + 1] = lerp_srgb(blend, color, 0);
                image.data[index + 2] = lerp_srgb(blend, color, 0);
            }
        }
    }
}
function drawKernelThresholded(image: ImageData, kernel: Kernel) {
    const w = image.width;
    const h = image.height;

    const { v00, v10, v01, v11, t } = kernel;

    const a = v11 - v10 - v01 + v00;
    const b = v10 - v00;
    const c = v01 - v00;
    const d = v00;

    const distances = new DistanceCache(w, h, kernel);

    const offsets: [number, number][] = [
        [-2 / 9, -1 / 9],
        [+1 / 9, -2 / 9],
        [+2 / 9, +1 / 9],
        [-1 / 9, +2 / 9],
        [-3 / 9, -4 / 9],
        [+4 / 9, -3 / 9],
        [+3 / 9, +4 / 9],
        [-4 / 9, +3 / 9],
    ];

    // draw threshold values
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const u = x / (w - 1);
            const v = y / (h - 1);
            const value = a * u * v + b * u + c * v + d;
            const color = value >= t ? 255 : 0;
            const index = (y * w + x) * 4;
            image.data[index] = color;
            image.data[index + 1] = color;
            image.data[index + 2] = color;
            image.data[index + 3] = 255;

            const dist = distances.dist(x, y) * image.width;
            if (dist < 0.707) {
                let sum = color;
                const samples = offsets.length + 1;

                for (const [du, dv] of offsets) {
                    const u_ = u + du / image.width;
                    const v_ = v + dv / image.height;
                    sum += a * u_ * v_ + b * u_ + c * v_ + d >= t ? 255 : 0;
                }

                image.data[index] = sum / samples;
                image.data[index + 1] = sum / samples;
                image.data[index + 2] = sum / samples;
            }
        }
    }
}
const STROKE_COLOR = "#e0b";
function drawSampleGrid(
    ctx: CanvasRenderingContext2D,
    { width, height }: CanvasInfo,
    kernel: Kernel,
    n: number,
) {
    const radius = (2 / 100) * width;
    const drawPoint = (u: number, v: number, above: boolean) => {
        ctx.fillStyle = above ? "white" : "black";
        ctx.strokeStyle = STROKE_COLOR;
        ctx.beginPath();
        ctx.arc(u * width, v * height, radius, 0, 2 * Math.PI);
        ctx.fill();
        ctx.lineWidth = radius / 4;
        ctx.stroke();
    };

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const u = (i + 0.5) / n;
            const v = (j + 0.5) / n;
            const value =
                (1 - u) * (1 - v) * kernel.v00 +
                u * (1 - v) * kernel.v10 +
                (1 - u) * v * kernel.v01 +
                u * v * kernel.v11;
            drawPoint(u, v, value >= kernel.t);
        }
    }
}
function drawSampleLines(
    ctx: CanvasRenderingContext2D,
    { width, height }: CanvasInfo,
    kernel: Kernel,
    vertical: boolean,
    n: number,
) {
    const innerRadius = (2 / 100) * width;
    const strokeWidth = (3 / 100) * width;
    const drawLine = (uOrV: number, change: number, leftAbove: boolean, rightAbove: boolean) => {
        ctx.beginPath();
        if (vertical) {
            ctx.moveTo(uOrV * width, 0);
            ctx.lineTo(uOrV * width, height);
        } else {
            ctx.moveTo(0, uOrV * height);
            ctx.lineTo(width, uOrV * height);
        }
        ctx.strokeStyle = STROKE_COLOR;
        ctx.lineWidth = strokeWidth;
        ctx.stroke();

        if (vertical) {
            change = 1 - change;
            [leftAbove, rightAbove] = [rightAbove, leftAbove];
        }
        const mid = change * (vertical ? height : width);

        ctx.beginPath();
        if (vertical) {
            ctx.moveTo(uOrV * width, 0);
            ctx.lineTo(uOrV * width, mid);
        } else {
            ctx.moveTo(0, uOrV * height);
            ctx.lineTo(mid, uOrV * height);
        }
        ctx.strokeStyle = leftAbove ? "white" : "black";
        ctx.lineWidth = innerRadius;
        ctx.stroke();

        ctx.beginPath();
        if (vertical) {
            ctx.moveTo(uOrV * width, mid);
            ctx.lineTo(uOrV * width, height);
        } else {
            ctx.moveTo(mid, uOrV * height);
            ctx.lineTo(width, uOrV * height);
        }
        ctx.strokeStyle = rightAbove ? "white" : "black";
        ctx.lineWidth = innerRadius;
        ctx.stroke();
    };

    if (vertical) {
        kernel = kernelRot90(kernel);
    }

    const { v00, v10, v01, v11, t } = kernel;
    const a = v11 - v10 - v01 + v00;
    const b = v10 - v00;
    const c = v01 - v00;
    const d = v00;

    // v(x,y) = axy + bx + cy + d
    // => x = (t - cy - d) / (ay + b)

    const EPSILON = 1e-6;
    for (let i = 0; i < n; i++) {
        const y = (i + 0.5) / n;
        const dx = a * y + b;

        const atX0 = c * y + d;
        const atX1 = a * y + b + c * y + d;
        if (Math.abs(dx) < EPSILON) {
            drawLine(y, 0, atX0 >= t, atX0 >= t);
            continue;
        }
        const rawX = (t - c * y - d) / dx;
        const x = Math.max(0, Math.min(1, rawX));
        let area = x;
        // if (dx > 0) area = 1 - area;
        drawLine(y, area, atX0 >= t, atX1 >= t);
    }
}

class DistanceCache {
    private yAtThreshold: number[];
    private xAtThreshold: number[];
    private w: number;
    private h: number;

    constructor(w: number, h: number, kernel: Kernel) {
        const { v00, v10, v01, v11, t } = kernel;

        const a = v11 - v10 - v01 + v00;
        const b = v10 - v00;
        const c = v01 - v00;
        const d = v00;

        const EPSILON = 1e-6;

        this.yAtThreshold = [];
        for (let x = 0; x < w; x++) {
            const u = x / (w - 1);
            const div = a * u + c;
            this.yAtThreshold[x] = Math.abs(div) > EPSILON ? (t - d - b * u) / div : Infinity;
        }

        this.xAtThreshold = [];
        for (let y = 0; y < h; y++) {
            const v = y / (h - 1);
            const div = a * v + b;
            this.xAtThreshold[y] = Math.abs(div) > EPSILON ? (t - d - c * v) / div : Infinity;
        }

        this.w = w;
        this.h = h;
    }

    dist(x: number, y: number) {
        const yAtThreshold = this.yAtThreshold[x];
        const xAtThreshold = this.xAtThreshold[y];
        const distY = Math.abs(yAtThreshold - y / (this.h - 1));
        const distX = Math.abs(xAtThreshold - x / (this.w - 1));
        return Math.min(distY, distX);
    }
}
