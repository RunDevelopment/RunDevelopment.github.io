"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ProblemLike } from "../../components/multiply-add/interfaces";
import { ProblemInput } from "../projects/multiply-add-constants-finder/ConversionConstantsSearch";
import { useDevicePixelRatio } from "../../hooks/useDevicePixelRatio";

interface Transform {
    /** Center x */
    x: number;
    /** Center y */
    y: number;
    scaleX: number;
    scaleY: number;
}

class RenderTransform {
    private readonly translateX: number;
    private readonly translateY: number;
    private readonly scaleX: number;
    private readonly scaleY: number;

    constructor(transform: Transform, canvasWidth: number, canvasHeight: number) {
        this.scaleX = 1 / transform.scaleX / canvasWidth;
        this.scaleY = 1 / transform.scaleY / canvasWidth;
        this.translateX = transform.x - (this.scaleX * canvasWidth) / 2;
        this.translateY = transform.y - (this.scaleY * canvasHeight) / 2;
    }

    pixelToWorld(x: number, y: number): [number, number] {
        return [x * this.scaleX + this.translateX, y * this.scaleY + this.translateY];
    }
    worldToPixel(x: number, y: number): [number, number] {
        return [(x - this.translateX) / this.scaleX, (y - this.translateY) / this.scaleY];
    }
}

function drawUnitCircle(ctx: CanvasRenderingContext2D, t: RenderTransform) {
    const imageData = ctx.getImageData(0, 0, ctx.canvas.width, ctx.canvas.height);

    const { width, height } = imageData;
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const i = (y * width + x) * 4;

            const [wx, wy] = t.pixelToWorld(x, y);
            const d = wx * wx + wy * wy;

            if (d <= 1) {
                imageData.data[i] = 255;
                imageData.data[i + 1] = 0;
                imageData.data[i + 2] = 0;
                imageData.data[i + 3] = 255;
            }
        }
    }

    ctx.putImageData(imageData, 0, 0);
}

function getRounding(problem: ProblemLike): number {
    switch (problem.rounding) {
        case "round":
            return problem.d >> 1;
        case "floor":
            return 0;
        case "ceil":
            return problem.d - 1;
    }
}

/**
 * Whether the linear function y = mx + b is a solution to the given problem.
 */
function linearFnIsSolution(problem: ProblemLike, [m, n]: [m: number, n: number]) {
    const { t, d, inputRange } = problem;
    const r = getRounding(problem);

    for (let x = 0; x <= inputRange; x++) {
        const expected = Math.floor((x * t + r) / d);
        const actual = Math.floor(m * x + n);
        if (expected !== actual) return false;
    }

    return true;
}
function linearFnSolveN(problem: ProblemLike, m: number): [nMin: number, nMax: number] | undefined {
    const { t, d, inputRange } = problem;
    const r = getRounding(problem);

    if (m <= 0) return undefined;

    let nMin = 0;
    let nMax = 1;

    for (let x = 1; x <= inputRange; x++) {
        // expected <= m * x + n < expected + 1
        // expected / (m*x) <= n < (expected + 1) / (m*x)
        const expected = Math.floor((x * t + r) / d);
        const n1 = expected / (m * x);
        const n2 = (expected + 1) / (m * x);
        nMin = Math.max(nMin, n1);
        nMax = Math.min(nMax, n2);
        if (nMin >= nMax) return undefined;
    }

    return [nMin, nMax];
}
function linearFnSolveM(problem: ProblemLike, n: number): [mMin: number, mMax: number] | undefined {
    const { t, d, inputRange } = problem;
    const r = getRounding(problem);

    if (n < 0 || n >= 1) return undefined;

    let mMin = 0;
    let mMax = Infinity;

    for (let x = 1; x <= inputRange; x++) {
        // expected <= m * x + n < expected + 1
        // (expected - n) / x <= m < (expected + 1 - n) / x
        const expected = Math.floor((x * t + r) / d);
        const m1 = (expected - n) / x;
        const m2 = (expected + 1 - n) / x;
        mMin = Math.max(mMin, m1);
        mMax = Math.min(mMax, m2);
        if (mMin >= mMax) return undefined;
    }

    return [mMin, mMax];
}
function linearFnSolvePotentialMFull(
    problem: ProblemLike,
): [mMinN0: number, mMaxN0: number, mMinN1: number, mMaxN1: number] {
    const { t, d, inputRange } = problem;
    const r = getRounding(problem);

    const x = inputRange;
    // expected <= m * x + n < expected + 1
    // (expected - n) / x <= m < (expected + 1 - n) / x
    const expected = Math.floor((x * t + r) / d);
    return [expected / x, (expected + 1) / x, (expected - 1) / x, expected / x];
}
/**
 * Returns a range of n values inside the given range that are all solutions.
 */
function findSolutionNRange(
    problem: ProblemLike,
    inRange: [number, number],
): [number, number] | undefined {
    let [rangeMin, rangeMax] = inRange;
    const rangeSize = rangeMax - rangeMin;
    const maxStepSize = 1 / problem.d;

    // Step 1: find any n that is a solution
    let middleN: number | undefined = undefined;
    for (let stepSize = 0; stepSize <= 10; stepSize++) {
        const steps = 1 << stepSize;
        for (let i = 0; i < steps; i++) {
            const alpha = (i + 0.5) / steps;
            const n = rangeMin + alpha * rangeSize;
            if (linearFnSolveM(problem, n)) {
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
        if (linearFnSolveN(problem, newMin)) {
            nMin = newMin;
        } else {
            rangeMin = newMin;
        }

        // max
        const newMax = (nMax + rangeMax) / 2;
        if (linearFnSolveN(problem, newMax)) {
            nMax = newMax;
        } else {
            rangeMax = newMax;
        }
    }

    return [nMin, nMax];
}

function drawSolutionSpace(
    ctx: CanvasRenderingContext2D,
    t: RenderTransform,
    problem: ProblemLike,
) {
    // show the area for the current x=input_range
    const potential = linearFnSolvePotentialMFull(problem);
    ctx.fillStyle = "#040";
    ctx.beginPath();
    ctx.moveTo(...t.worldToPixel(potential[0], 0));
    ctx.lineTo(...t.worldToPixel(potential[1], 0));
    ctx.lineTo(...t.worldToPixel(potential[3], 1));
    ctx.lineTo(...t.worldToPixel(potential[2], 1));
    ctx.closePath();
    ctx.fill();

    // show the area of actual solutions
    // const range = findSolutionNRange(problem, [
    //     Math.max(0, t.pixelToWorld(0, 0)[1]),
    //     Math.min(1, t.pixelToWorld(0, 1)[1]),
    // ]);
    // if (range) {
    //     ctx.fillStyle = "#fff";
    //     ctx.beginPath();
    // }
    const { height } = ctx.canvas;
    const leftSide: [number, number][] = [];
    for (let outerY = 0; outerY < height * 2; outerY++) {
        const y = outerY / 2;
        const n = t.pixelToWorld(0, y)[1];

        const solved = linearFnSolveM(problem, n);
        if (solved) {
            const x1 = t.worldToPixel(solved[0], 0)[0];
            const x2 = t.worldToPixel(solved[1], 0)[0];

            if (leftSide.length === 0) {
                ctx.fillStyle = "#fff";
                ctx.beginPath();
                ctx.moveTo(x2, y);
            } else {
                ctx.lineTo(x2, y);
            }
            leftSide.push([x1, y]);
        } else if (leftSide.length > 0) {
            break;
        }
    }
    if (leftSide.length > 0) {
        leftSide.reverse();
        for (const [x, y] of leftSide) {
            ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
    }
}

function drawTrivialSolutions(
    ctx: CanvasRenderingContext2D,
    t: RenderTransform,
    problem: ProblemLike,
) {
    const { width, height } = ctx.canvas;

    const r = getRounding(problem);
    const [expectedX, expectedY] = t.worldToPixel(problem.t / problem.d, r / problem.d);
    const [, expectedYAlt] = t.worldToPixel(0, (r + 1) / problem.d);
    ctx.strokeStyle = "rgb(255 64 255 / 75%)";
    ctx.lineWidth = 2;

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(expectedX, 0);
    ctx.lineTo(expectedX, height);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(0, expectedY);
    ctx.lineTo(width, expectedY);
    ctx.stroke();

    ctx.setLineDash([5, 3]);
    ctx.beginPath();
    ctx.moveTo(0, expectedYAlt);
    ctx.lineTo(width, expectedYAlt);
    ctx.stroke();
}

function drawLegend(ctx: CanvasRenderingContext2D, t: RenderTransform) {
    const minDistance = 60;
    const minDistance2 = 80;

    let stepSize = 1;
    const originPixels = t.worldToPixel(0, 0);
    let stepSizePixels = Math.abs(t.worldToPixel(0, stepSize)[1] - originPixels[1]);
    while (stepSizePixels / 10 > minDistance) {
        stepSize /= 10;
        stepSizePixels /= 10;
    }

    // some points
    const { width, height } = ctx.canvas;

    const closeToPrevStep = (v: number): boolean => {
        const prev = stepSize * 10;
        let m = ((v % prev) + prev) % prev;
        m = Math.min(m, prev - m);
        return m < 1e-8;
    };

    // n
    {
        let nMin = t.pixelToWorld(0, 0)[1];
        let nMax = t.pixelToWorld(0, height)[1];
        [nMin, nMax] = [Math.min(nMin, nMax), Math.max(nMin, nMax)];
        const nSteps = Math.ceil((nMax - nMin) / stepSize);
        const nStepStart = (Math.floor(nMin / stepSize) + 1) * stepSize;
        for (let i = 0; i <= nSteps; i++) {
            const n = nStepStart + i * stepSize;
            const y = t.worldToPixel(0, n)[1];
            const thick = closeToPrevStep(n);
            ctx.fillStyle = thick ? "rgb(200 200 200 / 80%)" : "rgb(150 150 150 / 70%)";
            ctx.fillRect(0, y, width, thick ? 2 : 1);

            ctx.fillStyle = "#fff";
            ctx.font = "12px Arial";
            ctx.fillText(`n=${Number(n.toFixed(10))}`, 10, y - 3);

            if (stepSizePixels > minDistance2) {
                ctx.fillStyle = "rgb(150 150 150 / 70%)";
                ctx.fillRect(0, y + stepSizePixels / 2, width, 0.5);

                ctx.fillStyle = "#fff";
                ctx.font = "12px Arial";
                ctx.fillText(
                    `n=${Number((n - stepSize / 2).toFixed(10))}`,
                    10,
                    y + stepSizePixels / 2 - 3,
                );
            }
        }
    }

    // m
    {
        let mMin = t.pixelToWorld(0, 0)[0];
        let mMax = t.pixelToWorld(width, 0)[0];
        [mMin, mMax] = [Math.min(mMin, mMax), Math.max(mMin, mMax)];
        const mSteps = Math.ceil((mMax - mMin) / stepSize);
        const mStepStart = Math.floor(mMin / stepSize) * stepSize;
        for (let i = 0; i <= mSteps; i++) {
            const m = mStepStart + i * stepSize;
            const x = t.worldToPixel(m, 0)[0];
            const thick = closeToPrevStep(m);
            ctx.fillStyle = thick ? "rgb(200 200 200 / 80%)" : "rgb(150 150 150 / 70%)";
            ctx.fillRect(x, 0, thick ? 2 : 1, height);

            ctx.fillStyle = "#fff";
            ctx.font = "12px Arial";
            ctx.fillText(`m=${Number(m.toFixed(10))}`, x + 4, height - 10);

            if (stepSizePixels > minDistance2) {
                ctx.fillStyle = "rgb(150 150 150 / 70%)";
                ctx.fillRect(x + stepSizePixels / 2, 0, 0.5, height);
            }
        }
    }
}

export function SolutionVisualizer() {
    const [problem, setProblem] = useState<ProblemLike>({
        rounding: "round",
        t: 1,
        d: 3,
        inputRange: 10,
    });

    const [transform, setTransform] = useState<Transform>({
        x: 0.5,
        y: 0.5,
        scaleX: 0.5,
        scaleY: -0.5,
    });

    const dpr = useDevicePixelRatio();

    useEffect(() => {
        const c = canvasRef.current;
        if (c) {
            c.style.width = c.clientWidth + "px";
            c.style.height = c.clientHeight + "px";
            c.width = c.clientWidth * dpr;
            c.height = c.clientHeight * dpr;
        }
    }, [dpr]);

    const canvasRef = useRef<HTMLCanvasElement>(null);
    const render = useCallback(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.fillStyle = "#000000";
        ctx.fillRect(-1, -1, ctx.canvas.width + 2, ctx.canvas.height + 2);
        // ctx.scale(dpr, dpr);

        // drawUnitCircle(ctx, new RenderTransform(transform, ctx.canvas.width));
        const start = performance.now();
        const t = new RenderTransform(transform, ctx.canvas.width, ctx.canvas.height);
        drawSolutionSpace(ctx, t, problem);
        drawLegend(ctx, t);
        drawTrivialSolutions(ctx, t, problem);
        console.log("Render time:", performance.now() - start);

        // ctx.fillStyle = "#fff";
        // ctx.font = "20px Arial";
        // ctx.fillText(
        //     `x=${transform.x.toFixed(4)} y=${transform.y.toFixed(4)} scale=${transform.scaleX.toFixed(4)} ${transform.scaleY.toFixed(4)}`,
        //     100,
        //     100,
        // );
    }, [problem, transform, dpr]);

    useEffect(() => {
        render();
    }, [render]);

    return (
        <>
            <div className="narrow">
                <ProblemInput
                    problem={problem}
                    setProblem={setProblem}
                    constraints={{ tMax: 100, dMax: 100, inputRangeMax: 100 }}
                />
            </div>
            <canvas
                ref={canvasRef}
                width={900}
                height={500}
                onWheel={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const canvas = canvasRef.current?.getContext("2d")?.canvas;
                    if (!canvas) return;
                    const { width, height } = canvas;
                    setTransform((t) => {
                        const newScaleX = transform.scaleX * (1 + -e.deltaY / 1000);
                        const newScaleY = transform.scaleY * (1 + -e.deltaY / 1000);

                        const pixelCoord = [e.nativeEvent.offsetX, e.nativeEvent.offsetY] as const;
                        // console.log(pixelCoord);
                        // console.log(e);
                        const oldT = new RenderTransform(t, width, height);
                        const worldCoord = oldT.pixelToWorld(...pixelCoord);
                        // the goal is to map this pixel coord to the same world coord with the new scale
                        const newT = new RenderTransform(
                            { ...t, scaleX: newScaleX, scaleY: newScaleY },
                            width,
                            height,
                        );
                        const newWorldCoord = newT.pixelToWorld(...pixelCoord);
                        const diffX = worldCoord[0] - newWorldCoord[0];
                        const diffY = worldCoord[1] - newWorldCoord[1];
                        return {
                            x: t.x + diffX,
                            y: t.y + diffY,
                            scaleX: newScaleX,
                            scaleY: newScaleY,
                        };
                    });
                }}
                onMouseMove={(e) => {
                    if (e.buttons === 1) {
                        e.preventDefault();
                        const canvas = canvasRef.current?.getContext("2d")?.canvas;
                        if (!canvas) return;
                        const { width, height } = canvas;
                        setTransform((t) => {
                            const rt = new RenderTransform(t, width, height);
                            const w0 = rt.pixelToWorld(0, 0);
                            const w1 = rt.pixelToWorld(1, 1);
                            const diffX = w0[0] - w1[0];
                            const diffY = w0[1] - w1[1];
                            return {
                                ...t,
                                x: t.x + e.movementX * diffX,
                                y: t.y + e.movementY * diffY,
                            };
                        });
                    }
                }}
            />
        </>
    );
}
