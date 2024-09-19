import { Conversion } from "./multiply-add-constants";
import precomputed from "./multiply-add-unorm-consts.json";

export const MAX_KNOWN_CONVERSION = Math.sqrt(precomputed.length);

export function getUnormConversion(from: number, to: number): Conversion {
    if (from <= MAX_KNOWN_CONVERSION && to <= MAX_KNOWN_CONVERSION) {
        return parseConversion(precomputed[(from - 1) * MAX_KNOWN_CONVERSION + (to - 1)]);
    }
    throw new Error(`No UNORM conversion data for ${from} -> ${to}`);
}

function parseConversion(s: string): Conversion {
    const [factor, add, shift] = s.split(",").map(Number);
    return { factor, add, shift };
}
