import { getImage } from "astro:assets";
import fs from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import sharp, { type Sharp } from "sharp";
import { fsExists, Mutex, toBase64Image } from "./util";

const PROJECT_DIR = path.resolve(".");
const PUBLIC_DIR = path.join(PROJECT_DIR, "public");
const BLOG_COVERS_DIR = path.join(PROJECT_DIR, "src/assets/blog-covers");

const imports = import.meta.glob<{ default: ImageMetadata }>([
    "/src/content/blog/**/*.{jpeg,jpg,png,gif,webp,avif,svg}",
    "/src/assets/blog-covers/*.{webp,avif}",
]);
const images = new Map(
    Object.entries(imports).map(([p, resolve]) => {
        // make file path absolute
        return [path.resolve(PROJECT_DIR, p.replace(/^[/\\]/, "")), resolve] as const;
    }),
);

export interface ImageInfo {
    src: string;
    width?: number;
    height?: number;
}

export async function resolveBlogImage(url: string, postFilePath: string): Promise<ImageInfo> {
    if (/^https?:\/\//.test(url)) {
        // return absolute URLs as is
        return { src: url };
    }

    if (url.startsWith("/")) {
        // references to public/ images remain unchanged; just read the dimensions of the file
        const file = path.join(
            PUBLIC_DIR,
            decodeURIComponent(url.replace(/\/public\//i, "/").slice(1)),
        );
        let metadata;
        try {
            metadata = await openImage(file).metadata();
        } catch (err) {
            console.error(`Error reading image metadata for ${file}:`, err);
        }
        return { src: url, width: metadata?.width, height: metadata?.height };
    }

    const postDir = path.resolve(PROJECT_DIR, path.dirname(postFilePath));
    const imagePath = path.resolve(postDir, decodeURIComponent(url));

    const imageImport = images.get(imagePath);
    if (!imageImport) {
        console.error(`Image not found: ${url}`);
        return { src: url };
    }
    const imageData = await getImage({ src: imageImport() });
    const { width, height } = imageData.options;
    return { src: imageData.src, width, height };
}

const COVER_CACHE = path.join(PROJECT_DIR, ".cover-cache");

export interface CoverImageInfo {
    src: string;
    srcLow?: string;
    inlineSrc: string;
    width?: number;
    height?: number;
}

export async function resolveBlogCoverImage(
    url: string,
    postFilePath: string,
): Promise<CoverImageInfo> {
    const postDir = path.resolve(PROJECT_DIR, path.dirname(postFilePath));
    const imagePath = path.resolve(postDir, decodeURIComponent(url));

    const COVER_WIDTH = 4096;
    const COVER_HEIGHT = 800;

    const name = getCleanBasename(imagePath);
    const coverPath = await generateCoverImage(imagePath, name, {
        width: COVER_WIDTH,
        height: COVER_HEIGHT,
        quality: 80,
    });
    const inlineSrc = await generateInlineImagePreviewData(coverPath);

    const postId = createHash("sha256").update(postFilePath).digest("hex").slice(0, 8);
    const blogCoverFile = path.join(BLOG_COVERS_DIR, `cover-${postId}${path.extname(coverPath)}`);
    await syncFile(coverPath, blogCoverFile);

    const coverMeta = await openImage(blogCoverFile).metadata();
    let srcLow;
    if (coverMeta.width === COVER_WIDTH && coverMeta.height === COVER_HEIGHT) {
        const coverLowPath = await generateCoverImage(blogCoverFile, name, {
            width: COVER_WIDTH / 2,
            height: COVER_HEIGHT / 2,
            quality: 85,
        });
        const blogCoverLowFile = path.join(
            BLOG_COVERS_DIR,
            `cover-lowRes-${postId}${path.extname(coverLowPath)}`,
        );
        await syncFile(coverLowPath, blogCoverLowFile);

        const coverImport = images.get(blogCoverLowFile);
        if (coverImport) {
            srcLow = (await getImage({ src: coverImport() })).src;
        }
    }

    const coverImport = images.get(blogCoverFile);
    if (!coverImport) {
        console.error(`Cover image not found: ${blogCoverFile}`);
        return { src: "", inlineSrc };
    }
    const imageData = await getImage({ src: coverImport() });
    const { width, height } = imageData.options;

    return { src: imageData.src, srcLow, inlineSrc, width, height };
}

async function syncFile(src: string, dest: string): Promise<void> {
    try {
        const stat1 = await fs.stat(src);
        const stat2 = await fs.stat(dest);
        if (stat1.size !== stat2.size) {
            throw new Error();
        }
    } catch {
        await fs.mkdir(path.dirname(dest), { recursive: true });
        await fs.copyFile(src, dest);
    }
}

async function generateCoverImage(
    imagePath: string,
    name: string,
    options: { width: number; height: number; quality: number },
): Promise<string> {
    try {
        // Use the image directly if it is small enough and AVIF. See the Fast Unorm article
        if (imagePath.endsWith(".avif")) {
            const org = await openImage(imagePath).metadata();
            const size = (await fs.stat(imagePath)).size;
            const maxBytesPerPixel = 0.175; // must be high compression
            if (org.height <= options.height && size < org.width * org.height * maxBytesPerPixel) {
                return imagePath;
            }
        }

        // Resize the image and encode as AVIF.
        const { width, height, quality } = options;

        const cachePath = await cachedImageFile(
            imagePath,
            "cover-" + name + "-#.avif",
            { height, width, quality },
            async (image) => {
                image = image.resize({
                    width,
                    height,
                    fit: "cover",
                    withoutEnlargement: true,
                });
                return image.avif({ quality }).toBuffer();
            },
        );

        return cachePath;
    } catch (cause) {
        throw new Error(`Failed to generate cover image for ${imagePath}`, {
            cause,
        });
    }
}

function getCleanBasename(filePath: string): string {
    return path
        .basename(filePath)
        .replace(/\.\w+$/, "")
        .replace(/[^\w\-]/g, "-");
}

async function generateInlineImagePreviewData(imagePath: string): Promise<string> {
    try {
        const format = "avif" as const;
        const options: InlinePreviewOptions = {
            height: 200,
            maxBytes: 4 * 1024,
            format,
            maxQuality: 50,
        };
        const cachePath = await cachedImageFile(
            imagePath,
            "preview-#." + format,
            options,
            createInlineImagePreview,
        );
        const imageBytes = await fs.readFile(cachePath);

        return toBase64Image(imageBytes, format);
    } catch (cause) {
        throw new Error(`Failed to generate inline image preview for ${imagePath}`, { cause });
    }
}

type InlinePreviewOptions = {
    height: number;
    width?: number;
    fit?: "cover" | "contain" | "inside" | "outside";
    maxBytes: number;
    format: "webp" | "avif" | "jpeg";
    maxQuality: number;
};
async function createInlineImagePreview(
    image: Sharp,
    options: InlinePreviewOptions,
): Promise<Buffer> {
    async function toTiny(image: Sharp, targetSize: number): Promise<Buffer> {
        const qualityRange = [1, options.maxQuality] as const;
        const [tiny] = await toTinyImage(
            image,
            targetSize,
            (image, quality) => {
                switch (options.format) {
                    case "webp":
                        return image.webp({
                            quality,
                            effort: 6,
                            smartDeblock: true,
                            smartSubsample: true,
                            preset: "photo",
                        });
                    case "avif":
                        return image.avif({ quality, effort: 6 });
                    case "jpeg":
                        return image.jpeg({ quality });
                }
            },
            qualityRange,
        );
        return tiny;
    }

    const resizedImage = image.resize({
        height: options.height,
        width: options.width,
        fit: options.fit ?? "outside",
    });
    return toTiny(resizedImage, options.maxBytes);
}
/**
 * Performs binary search to find the highest quality encoding of an image
 * that fits within the target size.
 */
async function toTinyImage(
    image: Sharp,
    targetSize: number,
    encode: (image: Sharp, quality: number) => Sharp,
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

function getLock(cachePath: string): Mutex {
    let lock = imageCacheLocks.get(cachePath);
    if (!lock) {
        lock = new Mutex();
        imageCacheLocks.set(cachePath, lock);
    }
    return lock;
}
const imageCacheLocks = new Map<string, Mutex>();

async function cachedImageFile<T>(
    srcImagePath: string,
    destNamePattern: string,
    options: T,
    encode: (image: Sharp, options: T) => Promise<Buffer>,
): Promise<string> {
    if (!destNamePattern.includes("#")) {
        throw new Error(
            "destNamePattern must include a '#' character to be replaced with the cache key.",
        );
    }

    const fileStats = await fs.stat(srcImagePath);
    const hash = createHash("sha256")
        .update(`${fileStats.size}\n${srcImagePath}\n${JSON.stringify(options)}`)
        .digest("hex")
        .slice(0, 8);
    const destName = destNamePattern.replace("#", hash);
    const cachePath = path.join(COVER_CACHE, destName);

    const unlock = await getLock(cachePath).lock();

    try {
        if (!(await fsExists(cachePath))) {
            console.info(`cache: Creating "${destName}" for ${srcImagePath}`);
            const buffer = await encode(openImage(srcImagePath), options);

            await fs.mkdir(COVER_CACHE, { recursive: true });
            await fs.writeFile(cachePath, buffer as never);
        }
    } finally {
        unlock();
    }

    return cachePath;
}
/**
 * A wrapper around `sharp` to work around a bug with AVIF images.
 */
export function openImage(path: string): Sharp {
    // https://github.com/immich-app/immich/issues/29574
    return sharp(path, { unlimited: true });
}
