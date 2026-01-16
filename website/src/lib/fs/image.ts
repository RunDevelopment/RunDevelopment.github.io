import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import sharp from "sharp";
import { IMAGE_CACHE_DIR } from "./config";
import { fsExists, Mutex } from "./util";

/**
 * A wrapper around `sharp` to work around a bug with AVIF images.
 */
export async function openImage(path: string): Promise<sharp.Sharp> {
    let img = sharp(path);

    // https://github.com/lovell/sharp/issues/4487
    if (path.toLowerCase().endsWith(".avif")) {
        const { pagePrimary } = await img.metadata();
        if (pagePrimary) {
            img = sharp(path, { page: pagePrimary });
        }
    }

    return img;
}

/**
 * Performs binary search to find the highest quality encoding of an image
 * that fits within the target size.
 */
export async function toTinyImage(
    image: sharp.Sharp,
    targetSize: number,
    encode: (image: sharp.Sharp, quality: number) => sharp.Sharp,
    qualityRange: readonly [number, number] = [1, 75],
): Promise<[Buffer, number]> {
    let best: Buffer | undefined = undefined;
    let bestQuality: number = NaN;

    let low = qualityRange[0];
    let high = qualityRange[1] + 1;

    do {
        const mid = (low + high) >> 1;
        const tiny = await encode(image, mid).toBuffer();
        if (tiny.length <= targetSize) {
            low = mid + 1; // try higher quality
        } else {
            high = mid; // try lower quality
        }
        if (
            !best ||
            (tiny.length < best.length && best.length > targetSize) ||
            (tiny.length > best.length && tiny.length <= targetSize)
        ) {
            best = tiny;
            bestQuality = mid;
        }
    } while (low < high);

    return [best, bestQuality];
}

/**
 * Performs binary search to find the highest quality encoding of an image
 * that fits within the target size.
 */
export async function cachedImageFile<T>(
    srcImagePath: string,
    destNamePattern: string,
    options: T,
    encode: (image: sharp.Sharp, options: T) => Promise<Buffer>,
): Promise<string> {
    if (!destNamePattern.includes("#")) {
        throw new Error(
            "destNamePattern must include a '#' character to be replaced with the cache key.",
        );
    }

    const hash = await getImageCacheKey(srcImagePath, [destNamePattern, options]);
    const destName = destNamePattern.replace("#", hash);
    const cachePath = path.join(IMAGE_CACHE_DIR, destName);

    const unlock = await getLock(cachePath).lock();

    try {
        if (!(await fsExists(cachePath))) {
            console.info(`cache: Creating "${destName}" for ${srcImagePath}`);
            const buffer = await encode(await openImage(srcImagePath), options);

            await fs.mkdir(IMAGE_CACHE_DIR, { recursive: true });
            await fs.writeFile(cachePath, buffer as never);
        }
    } finally {
        unlock();
    }

    return cachePath;
}

function getLock(cachePath: string): Mutex {
    let lock = imageCacheLocks.get(cachePath);
    if (!lock) {
        lock = new Mutex();
        imageCacheLocks.set(cachePath, lock);
    }
    return lock;
}
const imageCacheLocks = new Map<string, Mutex>();

async function getImageCacheKey(imagePath: string, options: unknown): Promise<string> {
    // I'm using the file size as a proxy for the content hash.
    // Not perfect, but very fast.
    const fileSize = await fs.stat(imagePath).then((stat) => stat.size);

    const hash = crypto.createHash("sha256");
    hash.update(fileSize.toString());
    hash.update(";");
    hash.update(imagePath);
    hash.update(";");
    hash.update(JSON.stringify(options));

    return hash.digest("hex").slice(0, 8);
}
