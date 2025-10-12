import path from "path";
import fs from "fs/promises";
import { ASSET_DIR } from "./config";

type KnownImageFormat = "jpeg" | "png" | "webp" | "avif" | "gif";

export function toBase64Image(data: Buffer, format: KnownImageFormat): `data:image/${string}`;
export function toBase64Image(data: Buffer, format: string): `data:image/${string}`;
export function toBase64Image(data: Buffer, format: string): `data:image/${string}` {
    return `data:image/${format};base64,${data.toString("base64")}`;
}

export async function getAsset(assetPath: string): Promise<Buffer> {
    assetPath = path.join(ASSET_DIR, assetPath);
    return fs.readFile(assetPath);
}

export async function getInlineImage(assetPath: `${string}.${KnownImageFormat}`): Promise<string> {
    const data = await getAsset(assetPath);
    const ext = assetPath.split(".").pop()!;
    return toBase64Image(data, ext);
}
