import React from "react";
import type { HeaderLink } from "./Header";
import PageSettings from "./PageSettings";
import "./BasicPage.css";

export interface BasicPageProps {
    children: React.ReactNode;
    selectedLink?: HeaderLink;
    fancyHeader?: boolean;
    tint?: string;
}
export default function BasicPage({ children, selectedLink, fancyHeader, tint }: BasicPageProps) {
    const baseColor: Rgb = [24, 24, 27];
    const tintColor = tint ? parseColor(tint) : null;
    const bgColor = tintColor ? tintBackground(baseColor, tintColor) : baseColor;

    return (
        <>
            <PageSettings
                fancyHeader={fancyHeader}
                selectedLink={selectedLink}
                pageBg={`rgb(${bgColor.map((c) => c.toFixed(1)).join(",")})`}
            />

            <main className="mx-auto box-content max-w-[var(--page-width)] px-4 pb-8 contain-size md:px-6">
                {children}
            </main>
        </>
    );
}

type Rgb = [number, number, number];
function parseColor(color: string): Rgb | null {
    const matchRgb = color.match(/^rgb\((\d+)[,\s]\s*(\d+)[,\s]\s*(\d+)\)$/);
    if (matchRgb) return [parseInt(matchRgb[1]), parseInt(matchRgb[2]), parseInt(matchRgb[3])];
    const matchHex = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
    if (matchHex)
        return [parseInt(matchHex[1], 16), parseInt(matchHex[2], 16), parseInt(matchHex[3], 16)];
    return null;
}

function tintBackground(baseColor: Rgb, tintColor: Rgb): Rgb {
    function colorLuma([r, g, b]: Rgb): number {
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
    function redness([r, g, b]: Rgb): number {
        const base = r - (g + b) / 2;
        const max = (Math.max(r, g, b) + 1) * 0.8;
        return Math.max(0, Math.min(base, max)) / max;
    }
    function saturate([r, g, b]: Rgb, amount: number): Rgb {
        const min = Math.min(r, g, b);
        const max = Math.max(r, g, b);
        const diff = max - min;
        if (diff < 0.1) return [r, g, b];
        amount = Math.min(amount, 255 / diff);
        const avg = (r + g + b) / 3;
        const newColor = [r, g, b].map((c) => (c - min) * amount) as Rgb;
        const newMin = Math.min(...newColor);
        const newMax = Math.max(...newColor);
        const newAvg = (newColor[0] + newColor[1] + newColor[2]) / 3;
        let offset = avg - newAvg;
        if (newMin + offset < 0) offset = -newMin;
        else if (newMax + offset > 255) offset = 255 - newMax;
        return newColor.map((c) => Math.max(0, Math.min(255, c + offset))) as Rgb;
    }

    // over-saturate the tint color to make different tints more consistent
    tintColor = saturate(tintColor, 4);

    // the maximum saturation depends on how red the tint color is. Most of the
    // website uses blue hues, so reds look awful.
    const MAX_SATURATION = 0.03 + 0.0 * (1 - redness(tintColor));
    const newColor = tintColor.map((c) => c * MAX_SATURATION) as Rgb;
    const newLuma = colorLuma(newColor);
    const baseLuma = colorLuma(baseColor);
    return newColor.map((c) => Math.max(0, c - newLuma + baseLuma)) as Rgb;
}
