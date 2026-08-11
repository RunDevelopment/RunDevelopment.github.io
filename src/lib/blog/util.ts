

import fs from "node:fs/promises";

type KnownImageFormat = "jpeg" | "png" | "webp" | "avif" | "gif";

export function toBase64Image(data: Buffer, format: KnownImageFormat): `data:image/${string}`;
export function toBase64Image(data: Buffer, format: string): `data:image/${string}`;
export function toBase64Image(data: Buffer, format: string): `data:image/${string}` {
    return `data:image/${format};base64,${data.toString("base64")}`;
}

export async function fsExists(file: string): Promise<boolean> {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}

export class Mutex {
    private _locked: boolean = false;

    async lock(): Promise<() => void> {
        while (this._locked) {
            await new Promise((resolve) => setTimeout(resolve, 1));
        }
        this._locked = true;
        return () => {
            this._locked = false;
        };
    }
}
