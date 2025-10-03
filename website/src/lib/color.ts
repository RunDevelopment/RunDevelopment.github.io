type Rgb = [r: number, g: number, b: number];

/**
 * Parses a hex color of the form `#FFF` or `#FFFFFF` into an RGB tuple.
 */
export function parseRgb(hex: string): Rgb {
    if (hex.length === 4) {
        const [r, g, b] = hex
            .slice(1)
            .split("")
            .map((c) => parseInt(c, 16) * 17);
        return [r, g, b];
    } else {
        const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
        return [r, g, b];
    }
}

export function interpolate(c0: Rgb, c1: Rgb, t: number): Rgb {
    return c0.map((c0, i) => c0 + t * (c1[i] - c0)) as Rgb;
}

export function toHex(color: Rgb): string {
    return "#" + color.map((c) => Math.round(c).toString(16).padStart(2, "0")).join("");
}
