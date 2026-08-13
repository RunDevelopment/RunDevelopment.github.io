/**
 * An RGB color. Channels are 0-1 in either linear or sRGB.
 */
export class Rgb {
    constructor(
        public r: number,
        public g: number,
        public b: number,
    ) {}

    /** Return luma as a weighted sum of the RGB channels. The color should be linear. */
    get luma(): number {
        return 0.2126 * this.r + 0.7152 * this.g + 0.0722 * this.b;
    }
    get min(): number {
        return Math.min(this.r, this.g, this.b);
    }
    get max(): number {
        return Math.max(this.r, this.g, this.b);
    }
    get avg(): number {
        return (this.r + this.g + this.b) / 3;
    }

    srgbToLinear(): Rgb {
        return new Rgb(Math.pow(this.r, 2.2), Math.pow(this.g, 2.2), Math.pow(this.b, 2.2));
    }
    linearToSrgb(): Rgb {
        return new Rgb(
            Math.pow(this.r, 1 / 2.2),
            Math.pow(this.g, 1 / 2.2),
            Math.pow(this.b, 1 / 2.2),
        );
    }

    toArray(): [number, number, number] {
        return [this.r, this.g, this.b];
    }
    toArrayU8(): [number, number, number] {
        return [toU8(this.r), toU8(this.g), toU8(this.b)];
    }

    /** Blends be `this` and `other`. t=0 will return `this` and t=1 will return `other`. */
    lerp(other: Rgb, t: number): Rgb {
        return new Rgb(
            this.r + (other.r - this.r) * t,
            this.g + (other.g - this.g) * t,
            this.b + (other.b - this.b) * t,
        );
    }
    clamp(min = 0, max = 1): Rgb {
        return new Rgb(
            Math.max(min, Math.min(max, this.r)),
            Math.max(min, Math.min(max, this.g)),
            Math.max(min, Math.min(max, this.b)),
        );
    }

    add(other: Rgb | number): Rgb {
        if (typeof other === "number") {
            return new Rgb(this.r + other, this.g + other, this.b + other);
        }
        return new Rgb(this.r + other.r, this.g + other.g, this.b + other.b);
    }
    mul(other: Rgb | number): Rgb {
        if (typeof other === "number") {
            return new Rgb(this.r * other, this.g * other, this.b * other);
        }
        return new Rgb(this.r * other.r, this.g * other.g, this.b * other.b);
    }

    saturateHsv(amount: number): Rgb {
        const [h, s, v] = rgbToHsv(this.r, this.g, this.b);
        return new Rgb(...hsvToRgb(h, Math.min(1, s * amount), v));
    }

    /** Returns an 8-bit hex color string. Color should be sRGB. */
    toCss(): string {
        const r = toU8(this.r).toString(16).padStart(2, "0");
        const g = toU8(this.g).toString(16).padStart(2, "0");
        const b = toU8(this.b).toString(16).padStart(2, "0");
        return `#${r}${g}${b}`;
    }

    static parse(color: string): Rgb | null {
        const matchRgb = color.match(/^rgb\((\d+)[,\s]\s*(\d+)[,\s]\s*(\d+)\)$/);
        if (matchRgb)
            return new Rgb(
                parseInt(matchRgb[1]) / 255,
                parseInt(matchRgb[2]) / 255,
                parseInt(matchRgb[3]) / 255,
            );

        const matchHex2 = color.match(/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i);
        if (matchHex2)
            return new Rgb(
                parseInt(matchHex2[1], 16) / 255,
                parseInt(matchHex2[2], 16) / 255,
                parseInt(matchHex2[3], 16) / 255,
            );

        const matchHex1 = color.match(/^#?([a-f\d])([a-f\d])([a-f\d])$/i);
        if (matchHex1)
            return new Rgb(
                parseInt(matchHex1[1], 16) / 15,
                parseInt(matchHex1[2], 16) / 15,
                parseInt(matchHex1[3], 16) / 15,
            );

        return null;
    }
    static fromRgb8(r: number, g: number, b: number): Rgb {
        return new Rgb(r / 255, g / 255, b / 255);
    }
    /**
     * @param h 0-360 degrees
     * @param s 0-1
     * @param v 0-1
     */
    static fromHsv(h: number, s: number, v: number): Rgb {
        return new Rgb(...hsvToRgb(h, s, v));
    }
}

function toU8(x: number) {
    return Math.round(Math.max(0, Math.min(1, x)) * 255);
}

/**
 * An HSV color.
 *
 * - H: 0-360 degrees
 * - S: 0-1
 * - V: 0-1
 */
export type Hsv = [number, number, number];

function rgbToHsv(r: number, g: number, b: number): Hsv {
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const delta = max - min;

    let h = 0;
    let s = max === 0 ? 0 : delta / max;
    let v = max;

    if (delta !== 0) {
        if (max === r) {
            h = ((g - b) / delta) % 6;
        } else if (max === g) {
            h = (b - r) / delta + 2;
        } else if (max === b) {
            h = (r - g) / delta + 4;
        }

        h *= 60;
        if (h < 0) h += 360;
    }

    return [h, s, v];
}
function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
    // Ensure Hue wraps around correctly if it exceeds 360 or is negative
    h = ((h % 360) + 360) % 360;

    const c = v * s; // Chroma
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;

    let r = 0,
        g = 0,
        b = 0;

    if (h >= 0 && h < 60) {
        r = c;
        g = x;
        b = 0;
    } else if (h >= 60 && h < 120) {
        r = x;
        g = c;
        b = 0;
    } else if (h >= 120 && h < 180) {
        r = 0;
        g = c;
        b = x;
    } else if (h >= 180 && h < 240) {
        r = 0;
        g = x;
        b = c;
    } else if (h >= 240 && h < 300) {
        r = x;
        g = 0;
        b = c;
    } else if (h >= 300 && h < 360) {
        r = c;
        g = 0;
        b = x;
    }

    return [r + m, g + m, b + m];
}
