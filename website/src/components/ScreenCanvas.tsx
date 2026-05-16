"use client";

import React, { useEffect, useRef, useState } from "react";
import { useDevicePixelRatio } from "../hooks/useDevicePixelRatio";

export class CanvasInfo {
    /** Width in canvas units (= CSS pixels). This may not be an integer. */
    width: number;
    /** Height in canvas units (= CSS pixels). This may not be an integer. */
    height: number;
    /** Device pixel ratio */
    devicePixelRatio: number;
    /** Width in device pixels. This is actual number of pixels displayed on screen. */
    pixelWidth: number;
    /** Height in device pixels. This is actual number of pixels displayed on screen. */
    pixelHeight: number;

    constructor(
        width: number,
        height: number,
        dpr: number,
        pixelWidth?: number,
        pixelHeight?: number,
    ) {
        this.width = width;
        this.height = height;
        this.devicePixelRatio = dpr;
        this.pixelWidth = pixelWidth ?? Math.round(Math.fround(width * dpr));
        this.pixelHeight = pixelHeight ?? Math.round(Math.fround(height * dpr));

        // There can be situations where the DPR is wrong. E.g. in chrome dev
        // tools, "Toggle device toolbar" for testing testing mobile devices
        // will set the DPR to 2 regardless of actual zoom DPR. So we detect
        // and correct wrong DPR.
        // The idea is that dpr = pixelWidth / width, but we also want to avoid
        // correcting for rounding errors.
        const dprWMin = (this.pixelWidth - 1) / this.width;
        const dprWMax = (this.pixelWidth + 1) / this.width;
        const dprHMin = (this.pixelHeight - 1) / this.height;
        const dprHMax = (this.pixelHeight + 1) / this.height;
        if (dpr < dprWMin || dpr > dprWMax || dpr < dprHMin || dpr > dprHMax) {
            this.devicePixelRatio =
                (this.pixelWidth + this.pixelHeight) / (this.width + this.height);
        }
    }
}

interface ScreenCanvasProps {
    className?: string;
    style?: React.CSSProperties;
    render: (ctx: CanvasRenderingContext2D, info: CanvasInfo) => void;
}
/**
 * A `canvas` that ensures that one pixel in the canvas corresponds to one device pixel, even on high-DPI screens.
 */
export default function ScreenCanvas({ className, style, render }: ScreenCanvasProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    const dpr = useDevicePixelRatio();
    const [width, setWidth] = useState(200);
    const [height, setHeight] = useState(200);
    const [pixelWidth, setPixelWidth] = useState<number | undefined>(undefined);
    const [pixelHeight, setPixelHeight] = useState<number | undefined>(undefined);
    const [initialized, setInitialized] = useState(false);

    const info = new CanvasInfo(width, height, dpr, pixelWidth, pixelHeight);

    // update width and height initially and periodically
    useEffect(() => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;

        const observer = new ResizeObserver((entries) => {
            const entry = entries.find((entry) => entry.target === canvas);
            if (entry) {
                setWidth(entry.contentRect.width);
                setHeight(entry.contentRect.height);
                setInitialized(true);

                // Safari doesn't support this.
                const devicePixelContentBoxSize = entry.devicePixelContentBoxSize?.at(0);
                if (devicePixelContentBoxSize) {
                    setPixelWidth(devicePixelContentBoxSize.inlineSize);
                    setPixelHeight(devicePixelContentBoxSize.blockSize);
                }
            }
        });
        observer.observe(canvas, { box: "device-pixel-content-box" });
        return () => observer.disconnect();
    }, []);

    // render
    useEffect(() => {
        if (!initialized) return;

        const ctx = canvasRef.current?.getContext("2d");
        if (!ctx) return;

        ctx.resetTransform();
        ctx.scale(info.devicePixelRatio, info.devicePixelRatio);

        render(ctx, info);
    }, [render, info, initialized]);

    // Fail safe in case something goes wrong.
    const MAX_SIZE = 4096;

    return (
        <canvas
            ref={canvasRef}
            tabIndex={-1}
            width={Math.min(MAX_SIZE, info.pixelWidth)}
            height={Math.min(MAX_SIZE, info.pixelHeight)}
            className={className}
            style={style}
        />
    );
}
