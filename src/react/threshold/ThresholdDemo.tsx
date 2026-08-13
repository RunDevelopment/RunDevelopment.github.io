import { useEffect, useRef, useState } from "react";
import { FiZoomIn, FiZoomOut } from "react-icons/fi";
import { MdGradient } from "react-icons/md";
import { PiCheckerboardFill } from "react-icons/pi";
import { RiResetLeftFill } from "react-icons/ri";
import { ButtonGroup, DownDown, NumberInput, SmallButton } from "../FormInputs";
import { type Kernel, kernelAreaLineSampling, rotateForHorizontalLineSampling } from "./kernel";

const SIZE = 120;

const IMAGES: {
    name: string;
    url: string;
    offset: [number, number];
    threshold: number;
}[] = [
    {
        name: "@",
        url: "/grayscale-images/at-sdf.webp",
        offset: [13, 10],
        threshold: 0.5,
    },
    {
        name: "Cat",
        url: "/grayscale-images/cat2.webp",
        offset: [187, 23],
        threshold: 0.25,
    },
    {
        name: "Leafs",
        url: "/grayscale-images/leafs.webp",
        offset: [47, 119],
        threshold: 0.4,
    },
    {
        name: "Waterfall",
        url: "/grayscale-images/waterfall1.webp",
        offset: [175, 80],
        threshold: 0.7,
    },
];

const START_IMAGE_INDEX = 1;

export function ThresholdDemo() {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const [smoothing, setSmoothing] = useState(0.5);
    const [threshold, setThreshold] = useState(IMAGES[START_IMAGE_INDEX].threshold);

    const [image, setImage] = useState<Uint8Array | null>(null);
    const [applyThreshold, setApplyThreshold] = useState(true);
    const [zoom, setZoom] = useState(false);
    const [imageIndex, setImageIndex] = useState(START_IMAGE_INDEX);

    useEffect(() => {
        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;
        if (!image) return;

        // const start = performance.now();
        const display = applyThreshold
            ? thresholdImage(image, Math.round(threshold * 255), smoothing)
            : image;
        // console.log(`Thresholding took ${performance.now() - start}ms`);

        const imageData = ctx.createImageData(SIZE, SIZE);
        if (zoom) {
            for (let y = 0; y < SIZE; y++) {
                for (let x = 0; x < SIZE; x++) {
                    const dx = (x >> 1) + (SIZE >> 2);
                    const dy = (y >> 1) + (SIZE >> 2);
                    const i = y * SIZE + x;

                    const value = display[dy * SIZE + dx];
                    imageData.data[i * 4] = value;
                    imageData.data[i * 4 + 1] = value;
                    imageData.data[i * 4 + 2] = value;
                    imageData.data[i * 4 + 3] = 255;
                }
            }
        } else {
            for (let i = 0; i < display.length; i++) {
                const value = display[i];
                imageData.data[i * 4] = value;
                imageData.data[i * 4 + 1] = value;
                imageData.data[i * 4 + 2] = value;
                imageData.data[i * 4 + 3] = 255;
            }
        }
        ctx.putImageData(imageData, 0, 0);
    }, [smoothing, image, zoom, applyThreshold, threshold]);

    const selectImage = (index: number) => {
        const image = IMAGES[index];

        loadImageGray(image.url)
            .then(([img, width]) => {
                setImage(cropImage(img, width, image.offset[0], image.offset[1], SIZE, SIZE));
                setImageIndex(index);
                setZoom(false);
                setThreshold(image.threshold);
            })
            .catch((err) => console.error("Failed to load image:", err));
    };

    // biome-ignore lint/correctness/useExhaustiveDependencies: only load image on mount
    useEffect(() => {
        selectImage(START_IMAGE_INDEX);
    }, []);

    return (
        <div className="mt-4 mb-8">
            <div
                className="mx-auto grid max-w-[400px] grid-cols-[auto_1fr] gap-y-1"
                style={{
                    opacity: applyThreshold ? "1" : "0.6",
                    filter: applyThreshold ? "none" : "grayscale(50%)",
                }}
            >
                <InputRow
                    label="Threshold"
                    value={threshold}
                    onChange={setThreshold}
                    min={0}
                    max={1}
                    step={0.1}
                    sliderStep={0.01}
                    reset={() => setThreshold(IMAGES[imageIndex].threshold)}
                />
                <InputRow
                    label="Smoothing"
                    value={smoothing}
                    onChange={setSmoothing}
                    min={0}
                    max={1}
                    step={0.1}
                    sliderStep={0.01}
                    reset={() => setSmoothing(0.5)}
                />
            </div>

            <div className="my-2 flex items-center justify-center gap-2">
                <DownDown
                    value={String(imageIndex)}
                    className="box-content h-8 !py-0"
                    options={Array.from({ length: IMAGES.length }, (_, i) => String(i))}
                    getLabel={(i) => IMAGES[Number(i)].name}
                    onChange={(i) => selectImage(Number(i))}
                />

                <ButtonGroup>
                    <SmallButton
                        onClick={() => setApplyThreshold(false)}
                        selected={!applyThreshold}
                        title="Show image"
                        className="!p-2"
                    >
                        <MdGradient size={16} />
                    </SmallButton>
                    <SmallButton
                        onClick={() => setApplyThreshold(true)}
                        selected={applyThreshold}
                        title="Show thresholded image"
                        className="!p-2"
                    >
                        <PiCheckerboardFill size={16} />
                    </SmallButton>
                </ButtonGroup>

                <SmallButton
                    onClick={() => setZoom((x) => !x)}
                    title="Toggle Zoom"
                    className="!p-2"
                >
                    {zoom ? <FiZoomOut size={16} /> : <FiZoomIn size={16} />}
                </SmallButton>
            </div>
            <div className="-mx-2 flex justify-center">
                <canvas
                    className="aspect-square w-full max-w-screen-xs"
                    style={{ imageRendering: "pixelated" }}
                    ref={canvasRef}
                    width={SIZE}
                    height={SIZE}
                />
            </div>
        </div>
    );
}

function InputRow({
    label,
    value,
    onChange,
    min,
    max,
    step,
    sliderStep,
    reset,
}: {
    label: string;
    value: number;
    onChange: (value: number) => void;
    min: number;
    max: number;
    step: number;
    sliderStep: number;
    reset: () => void;
}) {
    return (
        <>
            <label htmlFor={`input-${label}`} className="mr-2 content-center text-right">
                {label}
            </label>
            <span className="flex content-center">
                <input
                    className="mr-1 w-full py-2"
                    type="range"
                    min={min}
                    max={max}
                    size={0}
                    step={sliderStep}
                    value={value}
                    onChange={(e) => onChange(parseFloat(e.target.value))}
                    onDoubleClick={reset}
                />
                <ButtonGroup className="flex">
                    <NumberInput
                        className="pr-1"
                        id={`input-${label}`}
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={onChange}
                    />
                    <SmallButton onClick={reset} title="Reset" className="!pl-1.5">
                        <RiResetLeftFill size={16} />
                    </SmallButton>
                </ButtonGroup>
            </span>
        </>
    );
}

function thresholdImage(image: Uint8Array, threshold: number, smoothing: number): Uint8Array {
    if (image.length !== SIZE * SIZE)
        throw new Error(`Expected image of length ${SIZE * SIZE}, got ${image.length}`);

    const output = new Uint8Array(image.length);

    if (smoothing <= 0) {
        for (let i = 0; i < image.length; i++) {
            output[i] = image[i] > threshold ? 255 : 0;
        }
        return output;
    }

    const getArea = (kernel: Kernel) => {
        kernel = rotateForHorizontalLineSampling(kernel);
        return kernelAreaLineSampling(kernel, 1);
    };

    for (let y = 0; y < SIZE; y++) {
        const ym1 = Math.max(0, y - 1);
        const yp1 = Math.min(SIZE - 1, y + 1);
        for (let x = 0; x < SIZE; x++) {
            const xm1 = Math.max(0, x - 1);
            const xp1 = Math.min(SIZE - 1, x + 1);

            // get 3x3 neighborhood
            const tl = image[ym1 * SIZE + xm1];
            const tc = image[ym1 * SIZE + x];
            const tr = image[ym1 * SIZE + xp1];
            const cl = image[y * SIZE + xm1];
            const cc = image[y * SIZE + x];
            const cr = image[y * SIZE + xp1];
            const bl = image[yp1 * SIZE + xm1];
            const bc = image[yp1 * SIZE + x];
            const br = image[yp1 * SIZE + xp1];

            if (
                tl > threshold &&
                tc > threshold &&
                tr > threshold &&
                cl > threshold &&
                cc > threshold &&
                cr > threshold &&
                bl > threshold &&
                bc > threshold &&
                br > threshold
            ) {
                output[y * SIZE + x] = 255;
                continue;
            }
            if (
                tl < threshold &&
                tc < threshold &&
                tr < threshold &&
                cl < threshold &&
                cc < threshold &&
                cr < threshold &&
                bl < threshold &&
                bc < threshold &&
                br < threshold
            ) {
                output[y * SIZE + x] = 0;
                continue;
            }

            const q1: Kernel = {
                v00: sampleAt(tl, tc, cl, cc, 1 - smoothing, 1 - smoothing),
                v01: sampleAt(tl, tc, cl, cc, 1, 1 - smoothing),
                v10: sampleAt(tl, tc, cl, cc, 1 - smoothing, 1),
                v11: cc,
                t: threshold,
            };
            const q2: Kernel = {
                v00: sampleAt(tc, tr, cc, cr, 0, 1 - smoothing),
                v01: sampleAt(tc, tr, cc, cr, smoothing, 1 - smoothing),
                v10: cc,
                v11: sampleAt(tc, tr, cc, cr, smoothing, 1),
                t: threshold,
            };
            const q3: Kernel = {
                v00: sampleAt(cl, cc, bl, bc, 1 - smoothing, 0),
                v01: cc,
                v10: sampleAt(cl, cc, bl, bc, 1 - smoothing, smoothing),
                v11: sampleAt(cl, cc, bl, bc, 1, smoothing),
                t: threshold,
            };
            const q4: Kernel = {
                v00: cc,
                v01: sampleAt(cc, cr, bc, br, smoothing, 0),
                v10: sampleAt(cc, cr, bc, br, 0, smoothing),
                v11: sampleAt(cc, cr, bc, br, smoothing, smoothing),
                t: threshold,
            };

            const area = getArea(q1) + getArea(q2) + getArea(q3) + getArea(q4);
            output[y * SIZE + x] = (area / 4) * 255;
        }
    }

    return output;
}

function sampleAt(
    v00: number,
    v10: number,
    v01: number,
    v11: number,
    u: number,
    v: number,
): number {
    const y0 = v00 * (1 - u) + v10 * u;
    const y1 = v01 * (1 - u) + v11 * u;
    return y0 * (1 - v) + y1 * v;
}

function loadImageGray(src: string): Promise<[Uint8Array, number, number]> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = src;
        img.onload = () => {
            const { width, height } = img;
            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext("2d");
            if (!ctx) {
                reject(new Error("Could not create canvas context"));
                return;
            }

            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(0, 0, width, height);
            const data = new Uint8Array(width * height);
            for (let i = 0; i < data.length; i++) {
                data[i] = imageData.data[i * 4];
            }
            resolve([data, width, height]);
        };
        img.onerror = () => {
            reject(new Error(`Failed to load image at ${src}`));
        };
    });
}
function cropImage(
    image: Uint8Array,
    imageWidth: number,
    x: number,
    y: number,
    width: number,
    height: number,
): Uint8Array {
    const output = new Uint8Array(width * height);
    for (let j = 0; j < height; j++) {
        for (let i = 0; i < width; i++) {
            output[j * width + i] = image[(y + j) * imageWidth + (x + i)];
        }
    }
    return output;
}
