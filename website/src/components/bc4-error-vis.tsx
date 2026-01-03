"use client";

import React, { Dispatch, memo, SetStateAction, useEffect, useMemo, useRef, useState } from "react";
import { DownDown, SliderInput, SmallButton, SmallCheckbox } from "./FormInputs";

const INITIAL_BLOCK: Block = [
    0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 0.4, 0.3, 0.2, 0.1, 0.0, 0.15, 0.25, 0.35, 0.45, 0.55,
];

type BlockPrecision = "float" | "int";
function formatPixel(value: number, prec: BlockPrecision): string {
    if (prec === "float") {
        return value.toFixed(3);
    } else {
        return Math.round(value * 255).toString();
    }
}

export const Bc4ErrorVisualization = memo(() => {
    const [block, setBlock] = useState<Block>(INITIAL_BLOCK);
    const [blockPrec, setBlockPrec] = useState<BlockPrecision>("int");

    const roundedBlock = useMemo(() => {
        if (blockPrec === "float") {
            return block;
        } else {
            return block.map((v) => Math.round(v * 255) / 255);
        }
    }, [block, blockPrec]);

    return (
        <>
            <BlockInput
                block={block}
                setBlock={setBlock}
                blockPrec={blockPrec}
                setBlockPrec={setBlockPrec}
            />
            <ErrorCanvas block={roundedBlock} />
        </>
    );
});

type BlockInputProps = {
    block: Block;
    setBlock: Dispatch<SetStateAction<Block>>;
    blockPrec: BlockPrecision;
    setBlockPrec: Dispatch<SetStateAction<BlockPrecision>>;
};
const BlockInput = memo(({ block, setBlock, blockPrec, setBlockPrec }: BlockInputProps) => {
    const min = Math.min(...block);
    const max = Math.max(...block);
    const spread = max - min;
    const avg = block.reduce((a, b) => a + b, 0) / 16;

    const isSorted = useMemo(() => {
        for (let k = 1; k < block.length; k++) {
            if (block[k] < block[k - 1]) {
                return false;
            }
        }
        return true;
    }, [block]);

    const setToRandom = (min: number, max: number, exactBound = false, exp = 1) => {
        const block = Array.from({ length: 16 }, () => min + (max - min) * Math.random() ** exp);
        if (exactBound) {
            const i = Math.floor(Math.random() * 16);
            block[i] = min;
            let j = Math.floor(Math.random() * 16);
            while (j === i) {
                j = Math.floor(Math.random() * 16);
            }
            block[j] = max;
        }
        if (isSorted) {
            block.sort((a, b) => a - b);
        }
        setBlock(block);
    };
    const sort = () => setBlock((block) => block.slice().sort((a, b) => a - b));

    const sliderStep = blockPrec === "float" ? 0.001 : 1 / 255;

    const EPSILON = 0.0001;
    function setMinimum(block: Block, newMin: number): Block {
        block = block.slice();

        const min = Math.min(...block);
        const max = Math.max(...block);
        const scale = Math.max((max - newMin) / Math.max(max - min, EPSILON), EPSILON);
        for (let j = 0; j < 16; j++) {
            block[j] = (block[j] - min) * scale + newMin;
        }
        clamp(block);
        return block;
    }
    function setMaximum(block: Block, newMax: number): Block {
        block = block.slice();

        const min = Math.min(...block);
        const max = Math.max(...block);
        const scale = Math.max((newMax - min) / Math.max(max - min, EPSILON), EPSILON);
        for (let j = 0; j < 16; j++) {
            block[j] = (block[j] - max) * scale + newMax;
        }
        clamp(block);
        return block;
    }
    function setAverage(block: Block, newAverage: number): Block {
        block = block.slice();

        for (let i = 0; i < 10; i++) {
            const avg = block.reduce((a, b) => a + b, 0) / 16;
            const diff = newAverage - avg;
            for (let j = 0; j < 16; j++) {
                block[j] = Math.min(Math.max(block[j] + diff, 0), 1);
            }
            clamp(block);
        }
        return block;
    }
    function setSpread(block: Block, newSpread: number): Block {
        newSpread = Math.max(newSpread, EPSILON);

        const avg = block.reduce((a, b) => a + b, 0) / 16;
        const min = Math.min(...block);
        const max = Math.max(...block);
        const oldSpread = max - min;
        if (oldSpread < EPSILON / 2) {
            return block;
        }

        block = block.slice();
        for (let j = 0; j < 16; j++) {
            block[j] = ((block[j] - avg) / oldSpread) * newSpread + avg;
        }
        const newMin = Math.min(...block);
        if (newMin < 0) {
            for (let j = 0; j < 16; j++) {
                block[j] = block[j] - newMin;
            }
        }
        const newMax = Math.max(...block);
        if (newMax > 1) {
            for (let j = 0; j < 16; j++) {
                block[j] = block[j] + (1 - newMax);
            }
        }
        clamp(block);
        return block;
    }
    function clamp(block: Block) {
        for (let j = 0; j < 16; j++) {
            block[j] = Math.min(Math.max(block[j], 0), 1);
        }
    }

    const [showImage, setShowImage] = useState(false);
    const [blockXY, setBlockXY] = useState<{ x: number; y: number } | null>(null);

    const imgMouseHandler = (e: React.MouseEvent<HTMLImageElement, MouseEvent>) => {
        if ((e.buttons & 1) === 0) return;

        // get target x,y
        const rect = e.currentTarget.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const blockX = Math.floor(x / 4) * 4;
        const blockY = Math.floor(y / 4) * 4;

        // get pixel value at that position
        const canvas = document.createElement("canvas");
        canvas.width = 4;
        canvas.height = 4;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(e.currentTarget, -blockX, -blockY);
        const imageData = ctx.getImageData(0, 0, 4, 4);
        const newBlock: Block = [];
        for (let j = 0; j < 16; j++) {
            newBlock.push(imageData.data[j * 4] / 255);
        }
        setBlock(newBlock);
        setBlockXY({ x: blockX, y: blockY });
    };

    const [imageIndex, setImageIndex] = useState(0);
    const imageUrls = [
        "/grayscale-images/cat2.webp",
        "/grayscale-images/cat1.webp",
        "/grayscale-images/leafs.webp",
        "/grayscale-images/waterfall1.webp",
    ];
    const imageTitles = ["Cute cat", "Cool cat", "Leafs", "Waterfall"];

    return (
        <div
            className="flex flex-col gap-4 md:flex-row"
            style={{ flexWrap: showImage ? "wrap" : undefined }}
        >
            <div className="grid size-64 shrink-0 grid-cols-4 self-center md:self-start">
                {block.map((v, i) => (
                    <label
                        key={i}
                        className="flex items-center justify-center rounded-md"
                        htmlFor={"pixel" + i}
                        style={{
                            backgroundColor: `hsl(0 0 ${v * 100}%)`,
                            color: v > 0.65 ? "#222" : "white",
                        }}
                    >
                        {formatPixel(v, blockPrec)}
                    </label>
                ))}
            </div>
            <div className="flex flex-col items-center gap-x-4 gap-y-2 md:flex-row md:items-start">
                <SmallCheckbox
                    checked={showImage}
                    onChange={setShowImage}
                    text="Image Selector"
                    className="whitespace-nowrap md:[writing-mode:vertical-lr]"
                />
                <div
                    className="relative h-[256px] w-[320px] contain-layout"
                    style={{ display: showImage ? undefined : "none" }}
                >
                    <img
                        src={imageUrls[imageIndex]}
                        alt={imageTitles[imageIndex]}
                        className="select-none"
                        draggable={false}
                        width="320"
                        height="256"
                        style={{ imageRendering: "pixelated" }}
                        onMouseDown={imgMouseHandler}
                        onMouseMove={imgMouseHandler}
                    />
                    {blockXY && (
                        <span
                            className="absolute outline outline-1 outline-red-600"
                            style={{
                                top: blockXY.y + "px",
                                left: blockXY.x + "px",
                                width: "4px",
                                height: "4px",
                            }}
                        ></span>
                    )}
                </div>
                <div
                    className="flex gap-1 md:flex-col"
                    style={{ display: showImage ? undefined : "none" }}
                >
                    {imageTitles.map((title, i) => (
                        <SmallButton
                            key={i}
                            onClick={() => setImageIndex(i)}
                            selected={i === imageIndex}
                            className="w-10 lg:w-auto lg:text-left"
                        >
                            {i + 1}
                            <span className="hidden lg:inline">: {title}</span>
                        </SmallButton>
                    ))}
                </div>
            </div>
            <div className="grow" style={{ flexBasis: showImage ? "100%" : undefined }}>
                <div className="mb-4 flex flex-wrap gap-2">
                    <DownDown
                        value={blockPrec}
                        onChange={setBlockPrec}
                        options={["int", "float"]}
                        getLabel={(v) => ({ float: "Float", int: "UInt8" })[v]}
                    />
                    <SmallButton
                        onClick={() => setBlock(INITIAL_BLOCK)}
                        title="Reset to initial block."
                    >
                        Reset
                    </SmallButton>
                    <SmallButton
                        onClick={() => setToRandom(0, 1)}
                        title="Assign every pixel a uniformly random value between 0 and 1."
                    >
                        Rand
                    </SmallButton>
                    <SmallButton
                        onClick={() => setToRandom(min, max, true)}
                        title="Assign every pixel a uniformly random value between the current Min and Max."
                    >
                        Rand Within
                    </SmallButton>
                    <SmallButton
                        onClick={() => setToRandom(min, max, true, 4)}
                        title="Assign every pixel a random value between the current Min and Max that is *heavily* biased toward Min."
                    >
                        Rand Biased
                    </SmallButton>
                    <SmallButton onClick={sort} showActive={isSorted}>
                        Sort
                    </SmallButton>
                </div>
                <div className="mb-4 grid h-max grow grid-cols-4 gap-1">
                    {block.map((v, i) => (
                        <SliderInput
                            value={v}
                            min={0}
                            max={1}
                            key={i}
                            id={"pixel" + i}
                            step={sliderStep}
                            className="py-1"
                            onChange={(value) =>
                                setBlock((block) => {
                                    const newBlock = block.slice();
                                    newBlock[i] = value;
                                    return newBlock;
                                })
                            }
                        />
                    ))}
                </div>
                <div className="grid grid-cols-1 gap-1 xs:grid-cols-2">
                    {(
                        [
                            ["Min", min, setMinimum, "Minimum pixel value"],
                            ["Max", max, setMaximum, "Maximum pixel value"],
                            ["Avg", avg, setAverage, "Average (mean) pixel value"],
                            ["Spr", spread, setSpread, "Spread = Max - Min"],
                        ] as const
                    ).map(([label, value, setter, desc]) => (
                        <div key={label} className="flex gap-2">
                            <label
                                className="inline-block w-20 shrink-0 whitespace-nowrap text-right"
                                htmlFor={"stat-" + label}
                                title={desc}
                            >
                                {formatPixel(value, blockPrec) + " " + label}
                            </label>
                            <SliderInput
                                value={value}
                                className="w-full"
                                id={"stat-" + label}
                                min={0}
                                max={1}
                                step={sliderStep}
                                onChange={(value) => setBlock((block) => setter(block, value))}
                            />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
});

const ErrorCanvas = memo(({ block }: { block: Block }) => {
    const errorCanvasRef = useRef<HTMLCanvasElement>(null);
    const derivativesCanvasRef = useRef<HTMLCanvasElement>(null);

    const processingRef = useRef(false);
    const nextBlockRef = useRef<Block | null>(null);

    const [psnrData, setPsnrData] = useState<PsnrData | null>(null);

    useEffect(() => {
        nextBlockRef.current = block;
        if (processingRef.current) {
            return;
        }

        const errorContext = errorCanvasRef.current?.getContext("2d");
        const derivativesContext = derivativesCanvasRef.current?.getContext("2d");
        if (errorContext && derivativesContext) {
            processingRef.current = true;
            doAsync(async () => {
                let counter = 0;
                while (nextBlockRef.current) {
                    counter++;
                    const forceDraw = counter % 2 == 0;

                    const block = nextBlockRef.current;
                    nextBlockRef.current = null;

                    await threadYield();
                    const psnrData = PsnrData.compute(block);
                    await threadYield();
                    if (nextBlockRef.current && !forceDraw) continue;

                    const error = errorContext.createImageData(256, 256);
                    drawBlockError(psnrData, error);
                    errorContext.putImageData(error, 0, 0);
                    setPsnrData(psnrData);

                    try {
                        const controller = new AsyncController(async () => {
                            await threadYield();
                            return Boolean(nextBlockRef.current);
                        });
                        await controller.throwIfAborted();

                        const derivative = derivativesContext.createImageData(256, 256);
                        await drawBlockErrorDerivative(psnrData, derivative, controller);
                        derivativesContext.putImageData(derivative, 0, 0);

                        controller.throwIfAborted();
                    } catch (e) {
                        if (e instanceof AbortError) {
                            // aborted, do nothing
                        } else {
                            throw e;
                        }
                    }
                }
            }).finally(() => {
                processingRef.current = false;
            });
        }
    }, [block]);

    const pointsOfInterest = useMemo(() => {
        if (!psnrData) return [];

        const points: React.JSX.Element[] = [];

        const mark = ([e0, e1]: Endpoints, color: string, label: string, desc?: string) => {
            const left = `${((e0 + 0.5) / 256) * 100}%`;
            const top = `${((e1 + 0.5) / 256) * 100}%`;

            const measurement = `${psnrData.at(e0, e1).toFixed(2)} dB | ${e0}, ${e1}`;
            desc = measurement + " | " + (desc || label);

            points.push(
                <div
                    key={label}
                    className="absolute z-20 box-content size-[calc(min(2px,100%/256))] -translate-x-1/2 -translate-y-1/2 outline-1 outline-black hover:outline"
                    style={{ left, top, border: "solid 1px " + color }}
                    title={desc}
                ></div>,
            );
        };
        const toU8 = (e0: number, e1: number): Endpoints => {
            const toU8 = (v: number) => Math.min(Math.max(Math.round(v * 255), 0), 255);
            return [toU8(e0), toU8(e1)];
        };

        // trivial starting points
        const minP8 = Math.min(...psnrData.block);
        const maxP8 = Math.max(...psnrData.block);
        mark(
            toU8(maxP8, minP8),
            "black",
            "P8",
            "Trivial min/max starting point for 8-color palette",
        );

        const nonDefault = psnrData.block.filter((v) => v > 0.5 / 255 && v < 1 - 0.5 / 255);
        const minP62 = Math.min(...nonDefault);
        const maxP62 = Math.max(...nonDefault);
        mark(
            toU8(minP62, maxP62),
            "black",
            "P6",
            "Trivial min/max starting point for 6-color palette",
        );

        // nudged starting points
        const nudged = (pixels: number[]): Endpoints => {
            if (pixels.length === 0) {
                return [0, 0];
            }
            const nudge = 0.95;
            const mean = pixels.reduce((a, b) => a + b, 0) / pixels.length;
            const min = Math.min(...pixels);
            const max = Math.max(...pixels);
            const nudgedMin = mean + (min - mean) * nudge;
            const nudgedMax = mean + (max - mean) * nudge;
            return toU8(nudgedMin, nudgedMax);
        };
        const nudgeP8 = nudged(psnrData.block);
        const nudgeP62 = nudged(nonDefault);
        nudgeP8.reverse();
        mark(nudgeP8, "white", "P8n", "Nudged min/max for 8-color palette");
        mark(nudgeP62, "white", "P6n", "Nudged min/max for 6-color palette");

        // mark max PSNR
        mark(psnrData.max, "#f00", "best", `Max PSNR`);

        return points;
    }, [psnrData]);

    const [mousePos, setMousePos] = useState<Endpoints | null>(null);
    const isAtTopLeft = mousePos && mousePos[0] < 64 && mousePos[1] < 20;

    return (
        <div className="-mx-4 mt-4 flex flex-wrap items-start justify-center lg:mx-0">
            <div
                className="group relative aspect-square w-full max-w-[512px] md:w-[512px]"
                onMouseMove={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    const size = rect.width;
                    const toEndpoint = (v: number) => {
                        return Math.min(Math.max(Math.floor((v / size) * 256), 0), 255);
                    };
                    const e0 = toEndpoint(e.clientX - rect.left);
                    const e1 = toEndpoint(e.clientY - rect.top);
                    setMousePos([e0, e1]);
                }}
            >
                <canvas
                    className="size-full"
                    style={{ imageRendering: "pixelated" }}
                    ref={errorCanvasRef}
                    width="256"
                    height="256"
                />
                {...pointsOfInterest}
                {mousePos && psnrData && (
                    <span
                        className="pointer-events-none absolute top-1 hidden select-none self-center p-1 leading-none text-white group-hover:inline"
                        style={{
                            left: isAtTopLeft ? "33%" : "0.25rem",
                            backgroundColor: "rgba(0 0 0 / 40%)",
                            textShadow: "0 0 1px black",
                        }}
                    >{`${mousePos[0]}, ${mousePos[1]} | ${psnrData.at(...mousePos)?.toFixed(2)} db`}</span>
                )}
            </div>
            <canvas
                className="w-full max-w-[512px] md:w-auto"
                style={{ imageRendering: "pixelated" }}
                ref={derivativesCanvasRef}
                width="256"
                height="256"
            />
        </div>
    );
});

function doAsync<T>(fn: () => Promise<T>): Promise<T> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve(fn());
        }, 0);
    });
}
function threadYield(): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(() => {
            resolve();
        }, 0);
    });
}

async function drawBlockError(psnrData: PsnrData, imageData: ImageData) {
    const exp = 1;
    const scale = new ColorScale(
        [rgb(0, 0, 0), rgb(255, 0, 0), rgb(192, 64, 192), rgb(0, 255, 255)],
        0,
        Math.min(psnrData.maxPsnr ** exp, 100 ** exp),
    );

    const width = 256;
    const height = 256;
    if (imageData.width !== width || imageData.height !== height) {
        throw new Error("Invalid image data size");
    }

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const psnr = psnrData.at(x, y);
            const [r, g, b] = scale.getColor(psnr ** exp);

            const index = (y * imageData.width + x) * 4;
            imageData.data[index + 0] = r; // R
            imageData.data[index + 1] = g; // G
            imageData.data[index + 2] = b; // B
            imageData.data[index + 3] = 255; // A
        }
    }
}

async function drawBlockErrorDerivative(
    psnrData: PsnrData,
    imageData: ImageData,
    controller: AsyncController,
    fastDerivatives = false,
) {
    const width = 256;
    const height = 256;
    if (imageData.width !== width || imageData.height !== height) {
        throw new Error("Invalid image data size");
    }

    const psnrAt = (e0: number, e1: number): number => {
        const mse = getMseUnorm(psnrData.block, e0, e1);
        const psnr = 10 * -Math.log10(mse);
        return psnr;
    };

    console.time("Derivatives");
    const derivatives: number[] = [];
    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            let de0, de1;

            if (fastDerivatives) {
                const psnrXm1 = psnrData.at(Math.max(0, x - 1), y);
                const psnrXp1 = psnrData.at(Math.min(255, x + 1), y);
                const psnrYm1 = psnrData.at(x, Math.max(0, y - 1));
                const psnrYp1 = psnrData.at(x, Math.min(255, y + 1));
                de0 = ((psnrXm1 - psnrXp1) * 255) / 2;
                de1 = ((psnrYm1 - psnrYp1) * 255) / 2;
            } else {
                const e0 = x / 255;
                const e1 = y / 255;
                const d = 1 / 512;
                const psnr = psnrData.at(x, y);
                de0 = (psnr - psnrAt(e0 + d, e1)) / d;
                de1 = (psnr - psnrAt(e0, e1 + d)) / d;
            }

            derivatives.push(de0, de1);
        }
        if (y % 32 === 0) {
            await controller.throwIfAborted();
        }
    }
    console.timeEnd("Derivatives");

    await controller.throwIfAborted();
    console.time("Derivatives norm");
    const p99 = Math.round(0.02 * width * height);
    const list = derivatives.slice().sort((a, b) => Math.abs(b) - Math.abs(a));
    const norm = Math.abs(list[p99]);
    console.timeEnd("Derivatives norm");
    await controller.throwIfAborted();

    for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
            const dIndex = (y * width + x) * 2;
            let de0 = derivatives[dIndex + 0];
            let de1 = derivatives[dIndex + 1];
            de0 = (de0 / norm) * 0.5 + 0.5;
            de1 = (de1 / norm) * 0.5 + 0.5;

            const index = (y * width + x) * 4;
            imageData.data[index + 0] = de0 * 255; // R
            imageData.data[index + 1] = de1 * 255; // G
            imageData.data[index + 2] = 127; // B
            imageData.data[index + 3] = 255; // A
        }
    }

    await controller.throwIfAborted();
}

class AsyncController {
    private abortCondition: () => boolean | Promise<boolean>;

    constructor(abortCondition: () => boolean | Promise<boolean>) {
        this.abortCondition = abortCondition;
    }

    abort(): void {
        this.abortCondition = () => true;
    }

    async throwIfAborted(): Promise<void> {
        if (await this.abortCondition()) {
            throw new AbortError();
        }
    }
}
class AbortError extends Error {}

type Rgb = [number, number, number];
function rgb(r: number, g: number, b: number): Rgb {
    return [r, g, b];
}

class ColorScale {
    colors: Rgb[];
    from: number;
    to: number;

    constructor(colors: Rgb[], from: number, to: number) {
        if (from === to) throw new Error("ColorScale from and to cannot be equal");

        if (from > to) {
            [from, to] = [to, from];
            colors.reverse();
        }
        this.colors = colors;
        this.from = from;
        this.to = to;
    }

    getColor(value: number): Rgb {
        // we know: from <= to
        value = Math.min(Math.max(value, this.from), this.to);
        const t = (value - this.from) / (this.to - this.from);
        const scaledT = t * (this.colors.length - 1);
        const index = Math.floor(scaledT);
        const frac = scaledT - index;

        if (index >= this.colors.length - 1) {
            return this.colors[this.colors.length - 1];
        }
        if (index < 0) {
            return this.colors[0];
        }
        const c0 = this.colors[index];
        const c1 = this.colors[index + 1];

        const blend = (a: number, b: number, f: number) => Math.round(a + (b - a) * f);
        const r = blend(c0[0], c1[0], frac);
        const g = blend(c0[1], c1[1], frac);
        const b = blend(c0[2], c1[2], frac);

        return [r, g, b];
    }
}

/** A block of exactly 16 numbers between 0 and 1. */
type Block = number[];
/** Two 8-bit integer numbers representing the endpoints of a BC4 block. */
type Endpoints = [number, number];

class PsnrData {
    readonly block: Block;
    readonly mseValues: readonly number[];
    readonly psnrValues: readonly number[];
    readonly minMse: number;
    readonly maxPsnr: number;
    readonly max: Endpoints;

    private constructor(block: Block, mseValues: number[], min: Endpoints) {
        this.block = block.slice();
        this.mseValues = mseValues;
        this.minMse = mseValues[min[1] * 256 + min[0]];
        this.max = min;
        this.psnrValues = mseValues.map((mse) => 10 * -Math.log10(mse));
        this.maxPsnr = this.psnrValues[min[1] * 256 + min[0]];
    }

    at(e0: number, e1: number): number {
        return this.psnrValues[e1 * 256 + e0];
    }
    mseAt(e0: number, e1: number): number {
        return this.mseValues[e1 * 256 + e0];
    }

    static compute(block: Block): PsnrData {
        const start = performance.now();

        const mseValues: number[] = [];
        let minMse = Infinity;
        let min: Endpoints = [0, 0];
        for (let e1 = 0; e1 < 256; e1++) {
            for (let e0 = 0; e0 < 256; e0++) {
                const mse = getMseUnorm(block, e0 / 255, e1 / 255);
                mseValues.push(mse);
                if (mse < minMse) {
                    minMse = mse;
                    min = [e0, e1];
                }
            }
        }

        const data = new PsnrData(block, mseValues, min);

        const end = performance.now();
        console.log(`Computed PSNR values in ${(end - start).toFixed(1)} ms, max PSNR: ${minMse}`);

        return data;
    }
}

/**
 * Returns the MSE of a BC4_UNORM block.
 *
 * Endpoints e0 and e1 are expected to be between 0 and 1.
 */
function getMseUnorm(block: Block, e0: number, e1: number): number {
    // Generate the palette
    let e2, e3, e4, e5, e6, e7: number;
    if (e0 > e1) {
        // 6 interpolated values
        e2 = (6 * e0 + 1 * e1) / 7;
        e3 = (5 * e0 + 2 * e1) / 7;
        e4 = (4 * e0 + 3 * e1) / 7;
        e5 = (3 * e0 + 4 * e1) / 7;
        e6 = (2 * e0 + 5 * e1) / 7;
        e7 = (1 * e0 + 6 * e1) / 7;
    } else {
        // 4 interpolated values + 0 and 1
        e2 = 0.8 * e0 + 0.2 * e1;
        e3 = 0.6 * e0 + 0.4 * e1;
        e4 = 0.4 * e0 + 0.6 * e1;
        e5 = 0.2 * e0 + 0.8 * e1;
        e6 = 0.0;
        e7 = 1.0;
    }

    // Compute MSE
    let totalErrorSq = 0;
    for (let i = 0; i < 16; i++) {
        const pixel = block[i];

        // compute differences
        let diff0 = pixel - e0;
        let diff1 = pixel - e1;
        let diff2 = pixel - e2;
        let diff3 = pixel - e3;
        let diff4 = pixel - e4;
        let diff5 = pixel - e5;
        let diff6 = pixel - e6;
        let diff7 = pixel - e7;

        // square differences
        diff0 *= diff0;
        diff1 *= diff1;
        diff2 *= diff2;
        diff3 *= diff3;
        diff4 *= diff4;
        diff5 *= diff5;
        diff6 *= diff6;
        diff7 *= diff7;

        // find minimum
        if (diff0 > diff1) diff0 = diff1;
        if (diff2 > diff3) diff2 = diff3;
        if (diff4 > diff5) diff4 = diff5;
        if (diff6 > diff7) diff6 = diff7;
        if (diff0 > diff2) diff0 = diff2;
        if (diff4 > diff6) diff4 = diff6;
        if (diff0 > diff4) diff0 = diff4;

        totalErrorSq += diff0;
    }

    return totalErrorSq / 16;
}
