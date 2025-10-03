"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ProblemDesc,
    ProblemInput,
} from "../projects/multiply-add-constants-finder/ConversionConstantsSearch";
import { useDevicePixelRatio } from "../../hooks/useDevicePixelRatio";
import { DownDown, SmallButton } from "../../components/FormInputs";
import { GmaProblem } from "./gma";

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

// eslint-disable-next-line @typescript-eslint/no-unused-vars
function _drawUnitCircle(ctx: CanvasRenderingContext2D, t: RenderTransform) {
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

function drawSolutionSpace(
    ctx: CanvasRenderingContext2D,
    t: RenderTransform,
    { height }: CssSize,
    problem: GmaProblem,
) {
    {
        // show the area for the current x=input_range
        const current = problem.solveCurrentForFullM();

        const nMin = Math.max(0, Math.min(t.pixelToWorld(0, -1)[1], 1));
        const nMax = Math.max(0, Math.min(t.pixelToWorld(0, height)[1], 1));
        const [mMinN0, mMaxN0, mMinN1, mMaxN1] = current;
        const lerp = (a: number, b: number, t: number) => a * (1 - t) + b * t;
        const mMinNMin = lerp(mMinN0, mMinN1, nMin);
        const mMaxNMin = lerp(mMaxN0, mMaxN1, nMin);
        const mMinNMax = lerp(mMinN0, mMinN1, nMax);
        const mMaxNMax = lerp(mMaxN0, mMaxN1, nMax);

        ctx.fillStyle = "#040";
        ctx.beginPath();
        ctx.moveTo(...t.worldToPixel(mMinNMin, nMin));
        ctx.lineTo(...t.worldToPixel(mMaxNMin, nMin));
        ctx.lineTo(...t.worldToPixel(mMaxNMax, nMax));
        ctx.lineTo(...t.worldToPixel(mMinNMax, nMax));
        ctx.closePath();
        ctx.fill();
    }

    // show the area of actual solutions
    // const range = findSolutionNRange(problem, [
    //     Math.max(0, t.pixelToWorld(0, 0)[1]),
    //     Math.min(1, t.pixelToWorld(0, 1)[1]),
    // ]);
    // if (range) {
    //     ctx.fillStyle = "#fff";
    //     ctx.beginPath();
    // }
    const leftSide: [number, number][] = [];
    for (let outerY = 0; outerY < height * 2; outerY++) {
        const y = outerY / 2;
        const n = t.pixelToWorld(0, y)[1];

        const solved = problem.solveForM(n);
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
    { width, height }: CssSize,
    problem: GmaProblem,
) {
    const [expectedX, expectedY] = t.worldToPixel(problem.t / problem.d, problem.r / problem.d);
    const [, expectedYAlt] = t.worldToPixel(0, (problem.r + 1) / problem.d);
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

function drawLegend(ctx: CanvasRenderingContext2D, t: RenderTransform, { width, height }: CssSize) {
    const minDistance = 60;
    const minDistance2 = 80;

    const originPixels = t.worldToPixel(0, 0);
    const oneOnePixels = t.worldToPixel(1, 1);

    const closeToPrevStep = (v: number, stepSize: number): boolean => {
        const prev = stepSize * 10;
        let m = ((v % prev) + prev) % prev;
        m = Math.min(m, prev - m);
        return m < 1e-8;
    };

    function drawStroked(text: string, x: number, y: number) {
        ctx.font = "12px Arial";
        ctx.fillStyle = "black";
        const d = 1.33;
        ctx.fillText(text, x - d, y - d);
        ctx.fillText(text, x + d, y - d);
        ctx.fillText(text, x - d, y + d);
        ctx.fillText(text, x + d, y + d);
        ctx.fillText(text, x - d, y);
        ctx.fillText(text, x + d, y);
        ctx.fillText(text, x, y - d);
        ctx.fillText(text, x, y + d);
        ctx.fillStyle = "white";
        ctx.fillText(text, x, y);
    }

    const printNumber = (n: number): string => {
        return Number(n.toExponential(13)).toString();
    };

    // n
    {
        let stepSize = 1;
        let stepSizePixels = Math.abs(oneOnePixels[1] - originPixels[1]);
        while (stepSizePixels / 10 > minDistance) {
            stepSize /= 10;
            stepSizePixels /= 10;
        }

        let nMin = t.pixelToWorld(0, 0)[1];
        let nMax = t.pixelToWorld(0, height)[1];
        [nMin, nMax] = [Math.min(nMin, nMax), Math.max(nMin, nMax)];
        const nSteps = Math.ceil((nMax - nMin) / stepSize);
        const nStepStart = (Math.floor(nMin / stepSize) + 1) * stepSize;
        for (let i = 0; i <= nSteps; i++) {
            const n = nStepStart + i * stepSize;
            const y = t.worldToPixel(0, n)[1];
            const thick = closeToPrevStep(n, stepSize);
            ctx.fillStyle = thick ? "rgb(200 200 200 / 80%)" : "rgb(150 150 150 / 70%)";
            ctx.fillRect(0, y, width, thick ? 2 : 1);

            // ctx.fillStyle = "#fff";
            // ctx.font = "12px Arial";
            // ctx.fillText(`n=${Number(n.toFixed(10))}`, 10, y - 3);
            drawStroked(`n=${printNumber(n)}`, 10, y - 3);

            if (stepSizePixels > minDistance2) {
                ctx.fillStyle = "rgb(150 150 150 / 70%)";
                ctx.fillRect(0, y + stepSizePixels / 2, width, 0.5);

                // ctx.fillStyle = "#fff";
                // ctx.font = "12px Arial";
                // ctx.fillText(
                //     `n=${Number((n - stepSize / 2).toFixed(10))}`,
                //     10,
                //     y + stepSizePixels / 2 - 3,
                // );
                drawStroked(`n=${printNumber(n - stepSize / 2)}`, 10, y + stepSizePixels / 2 - 3);
            }
        }
    }

    // m
    {
        let stepSize = 1;
        let stepSizePixels = Math.abs(oneOnePixels[0] - originPixels[0]);
        while (stepSizePixels / 10 > minDistance) {
            stepSize /= 10;
            stepSizePixels /= 10;
        }

        let mMin = t.pixelToWorld(0, 0)[0];
        let mMax = t.pixelToWorld(width, 0)[0];
        [mMin, mMax] = [Math.min(mMin, mMax), Math.max(mMin, mMax)];
        const mSteps = Math.ceil((mMax - mMin) / stepSize);
        const mStepStart = Math.floor(mMin / stepSize) * stepSize;
        for (let i = 0; i <= mSteps; i++) {
            const m = mStepStart + i * stepSize;
            const x = t.worldToPixel(m, 0)[0];
            const thick = closeToPrevStep(m, stepSize);
            ctx.fillStyle = thick ? "rgb(200 200 200 / 80%)" : "rgb(150 150 150 / 70%)";
            ctx.fillRect(x, 0, thick ? 2 : 1, height);

            // ctx.fillStyle = "#fff";
            // ctx.font = "12px Arial";
            drawStroked(`m=${printNumber(m)}`, x + 4, height - 10);

            if (stepSizePixels > minDistance2) {
                ctx.fillStyle = "rgb(150 150 150 / 70%)";
                ctx.fillRect(x + stepSizePixels / 2, 0, 0.5, height);
            }
        }
    }
}

type ScaleMode = "xy" | "x" | "y";

/**
 * The size of the canvas in CSS pixels.
 *
 * `scale` is the ratio of the canvas size to the actual pixel size. So e.g.
 * `width * scale` is the actual pixel width.
 */
interface CssSize {
    width: number;
    height: number;
    scale: number;
}

export function SolutionVisualizer() {
    const [problem, setProblem] = useState<GmaProblem>(() =>
        GmaProblem.from({ rounding: "round", t: 1, d: 3, inputRange: 10 }),
    );

    const [transform, setTransform] = useState<Transform>({
        x: 0.5,
        y: 0.5,
        scaleX: 0.5,
        scaleY: -0.5,
    });

    const [scaleMode, setScaleMode] = useState<ScaleMode>("xy");

    const dpr = useDevicePixelRatio();

    useEffect(() => {
        const c = canvasRef.current;
        if (c) {
            c.style.width = c.clientWidth + "px";
            c.style.height = c.clientHeight + "px";
            c.width = Math.ceil(c.clientWidth * dpr);
            c.height = Math.ceil(c.clientHeight * dpr);
        }
    }, [dpr]);

    const canvasRef = useRef<HTMLCanvasElement>(null);

    const render = useCallback(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.resetTransform();
        ctx.scale(dpr, dpr);

        const css: CssSize = {
            width: ctx.canvas.clientWidth,
            height: ctx.canvas.clientHeight,
            scale: dpr,
        };
        console.log(css);

        ctx.fillStyle = "#000000";
        ctx.fillRect(-1, -1, css.width + 2, css.height + 2);

        // drawUnitCircle(ctx, new RenderTransform(transform, ctx.canvas.width));
        const start = performance.now();
        const t = new RenderTransform(transform, css.width, css.height);
        drawSolutionSpace(ctx, t, css, problem);
        drawLegend(ctx, t, css);
        drawTrivialSolutions(ctx, t, css, problem);
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

    const onWheel = useCallback(
        (e: WheelEvent) => {
            e.preventDefault();

            const canvas = canvasRef.current?.getContext("2d")?.canvas;
            if (!canvas) return;
            const { clientWidth: width, clientHeight: height } = canvas;
            setTransform((t) => {
                const doScaleX = scaleMode === "xy" || scaleMode === "x";
                const doScaleY = scaleMode === "xy" || scaleMode === "y";
                const newScaleX = doScaleX ? t.scaleX * (1 + -e.deltaY / 1000) : t.scaleX;
                const newScaleY = doScaleY ? t.scaleY * (1 + -e.deltaY / 1000) : t.scaleY;

                const pixelCoord = [e.offsetX, e.offsetY] as const;
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
        },
        [scaleMode],
    );
    const onMouseMove: React.MouseEventHandler = (e) => {
        if (e.buttons === 1) {
            e.preventDefault();
            const canvas = canvasRef.current?.getContext("2d")?.canvas;
            if (!canvas) return;
            const { clientWidth: width, clientHeight: height } = canvas;
            setTransform((t) => {
                const rt = new RenderTransform(t, width, height);
                const w0 = rt.pixelToWorld(0, 0);
                const w1 = rt.pixelToWorld(1, 1);
                const diffX = w0[0] - w1[0];
                const diffY = w0[1] - w1[1];
                return {
                    ...t,
                    x: t.x + (e.movementX / dpr) * diffX,
                    y: t.y + (e.movementY / dpr) * diffY,
                };
            });
        }
    };
    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener("wheel", onWheel, { passive: false });
            return () => {
                canvas.removeEventListener("wheel", onWheel);
            };
        }
    }, [onWheel]);

    const problemDesc = useMemo((): ProblemDesc => {
        return {
            rounding: problem.rounding,
            t: BigInt(problem.t),
            d: BigInt(problem.d),
            u: BigInt(problem.inputRange),
            inputLimit: 2 ** 16 - 1,
        };
    }, [problem]);

    return (
        <>
            <div className="narrow">
                <ProblemInput
                    problem={problemDesc}
                    setProblem={(p) => {
                        if (typeof p === "function") {
                            setProblem(() => GmaProblem.fromDesc(p(problemDesc)));
                        } else {
                            setProblem(GmaProblem.fromDesc(p));
                        }
                    }}
                />
                <div className="py-4">
                    Scale mode:{" "}
                    <DownDown
                        value={scaleMode}
                        onChange={setScaleMode}
                        options={["xy", "x", "y"]}
                        getLabel={(m) => ({ xy: "Both", x: "Only m", y: "Only n" })[m]}
                    />
                    <div className="mt-4 flex gap-2">
                        <SmallButton
                            onClick={() => {
                                setTransform({ x: 0.5, y: 0.5, scaleX: 0.5, scaleY: -0.5 });
                            }}
                        >
                            Reset view
                        </SmallButton>
                        <SmallButton
                            onClick={() => {
                                const { t, d, r } = problem;
                                const solvedRange = problem.solveForM(r / d)!;
                                const mRange = solvedRange[1] - solvedRange[0];
                                const nRange = 1 / d;
                                setTransform({
                                    x: t / d,
                                    y: (r + 0.5) / d,
                                    scaleX: 0.25 / mRange,
                                    scaleY: -0.166 / nRange,
                                });
                            }}
                        >
                            Focus
                        </SmallButton>
                    </div>
                </div>
            </div>
            <canvas
                ref={canvasRef}
                tabIndex={-1}
                width={900}
                height={500}
                onMouseMove={onMouseMove}
            />
        </>
    );
}
