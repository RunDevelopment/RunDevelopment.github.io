import path from "path";
import fs from "fs/promises";
import YAML from "yaml";
import { ImageSize, InternalPostId, PostMetadata, PostWithInternals } from "../schema";
import { timedCached } from "../util";
import crypto from "crypto";
import { IS_DEV, POST_DIR, IMAGE_CACHE_DIR } from "./config";
import sizeOf from "image-size";
import { promisify } from "util";
import sharp from "sharp";
import { toBase64Image } from "./util";

export const getPostsWithInternals = timedCached(2000, async () => {
    const postFiles = await fs.readdir(POST_DIR, {
        encoding: "utf-8",
        recursive: true,
    });
    // find all markdown files in POST_DIR
    const postIds = postFiles
        .filter((file) => file.endsWith(".md"))
        .map((file) => file as InternalPostId);

    let posts = await Promise.all(postIds.map(getPost));

    // drafts are only shown in dev mode
    if (!IS_DEV) {
        posts = posts.filter((post) => !post.post.metadata.draft);
    }

    return posts;
});

const getPost = timedCached(2000, async (id: InternalPostId): Promise<PostWithInternals> => {
    const filePath = path.join(POST_DIR, id);
    const fileDir = path.dirname(filePath);
    const content = await fs.readFile(filePath, { encoding: "utf-8" });

    let frontMatter = undefined;
    let markdown = content;
    if (content.startsWith("---")) {
        const frontMatterEnd = content.indexOf("\n---\n");
        frontMatter = YAML.parse(content.slice(4, frontMatterEnd)) as FrontMatter;
        markdown = content.slice(frontMatterEnd + 5);
    }

    const metadata = getMetadata(frontMatter ?? {}, markdown);

    // image URLs
    await fixMetadataImagePaths(fileDir, metadata);
    await inlineImagePreviewData(fileDir, metadata);

    const imageUrls = getImageUrls(markdown);
    if (metadata.image) {
        imageUrls.push(metadata.image);
    }
    if (metadata.imageSmall) {
        imageUrls.push(metadata.imageSmall);
    }

    const imageUrlMapping: Record<string, string> = {};
    const referencedImageFiles: Record<string, string> = {};
    const imageSizes: Record<string, ImageSize> = {};
    for (const url of imageUrls) {
        const isRelative = /^(?:\.\.?\/|(?!http)\w)/.test(url);
        if (isRelative) {
            const imageFilePath = path.resolve(path.join(fileDir, decodeURIComponent(url)));
            const imageFileName = path.basename(imageFilePath).replace(/[^\w\-.]/g, "-");
            imageUrlMapping[url] = `/images/${imageFileName}`;
            referencedImageFiles[imageFilePath] = imageFileName;

            try {
                const size = await getImageSize(imageFilePath);
                if (size?.width && size?.height) {
                    imageSizes[url] = { width: size.width, height: size.height };
                }
            } catch (e) {
                console.error(`Error getting image size for ${imageFilePath}: ${e}`);
            }
        }
    }

    if (metadata.image) {
        metadata.image = imageUrlMapping[metadata.image] || metadata.image;
    }
    if (metadata.imageSmall) {
        metadata.imageSmall = imageUrlMapping[metadata.imageSmall] || metadata.imageSmall;
    }

    return { post: { metadata, markdown, imageUrlMapping, imageSizes }, id, referencedImageFiles };
});

const getImageSize = timedCached(2000, async (imagePath: string) => {
    return await promisify(sizeOf)(imagePath);
});

interface FrontMatter {
    slug: string;
    description: string;
    datePublished: string;
    dateModified: string;
    draft: boolean;
    inlineCodeLanguage: string;
    tags: string;
    image: string;
    imageLoad: string;
    imageSmall: string;
    color: string;
}
type PartialNull<T> = {
    [P in keyof T]?: T[P] | null;
};

function getMetadata(frontMatter: PartialNull<FrontMatter>, markdown: string): PostMetadata {
    const title = getMarkdownHeader(markdown);
    const slug =
        frontMatter.slug ??
        title
            .toLowerCase()
            .replace(/[:'"()]/g, "")
            .replace(/\s+/g, "-");
    const description = frontMatter.description ?? "No description found";

    const datePublished = frontMatter.datePublished ?? "TBD";
    const dateModified = frontMatter.dateModified ?? datePublished;

    const draft = frontMatter.draft ?? false;

    const inlineCodeLanguage = frontMatter.inlineCodeLanguage ?? undefined;

    const color = frontMatter.color ?? getPostColor(slug);
    const image = frontMatter.image ?? undefined;
    const imageSmall = frontMatter.imageSmall ?? image?.replace(/\.(\w+)$/, "_small.$1");

    const tags = (frontMatter.tags ?? "")
        .split(/\s+/)
        .map((tag) => tag.trim().toLowerCase())
        .filter(Boolean)
        .sort();
    if (draft) {
        tags.unshift("draft");
    }

    const minutesToRead = getMinutesToRead(markdown);

    return {
        title,
        description,
        slug,
        datePublished,
        dateModified,
        draft,
        inlineCodeLanguage,
        tags,
        color,
        image,
        imageSmall,
        minutesToRead,
    };
}

async function fixMetadataImagePaths(relativeTo: string, metadata: PostMetadata) {
    async function resolve(url: string | undefined): Promise<string | undefined> {
        if (!url) return undefined;

        const file = path.resolve(path.join(relativeTo, decodeURIComponent(url)));
        if (await fsExists(file)) {
            return url;
        }

        // try other extensions
        const otherExtensions = [".avif", ".webp", ".jpg", ".jpeg", ".png", ".gif"];
        for (const ext of otherExtensions) {
            const newUrl = url.replace(/\.\w+$/, ext);
            const newFile = path.resolve(path.join(relativeTo, decodeURIComponent(newUrl)));
            if (await fsExists(newFile)) {
                return newUrl;
            }
        }

        return undefined;
    }

    await Promise.all([
        resolve(metadata.image).then((url) => (metadata.image = url)),
        resolve(metadata.imageSmall).then((url) => (metadata.imageSmall = url)),
    ]);
}

async function fsExists(file: string): Promise<boolean> {
    try {
        await fs.access(file);
        return true;
    } catch {
        return false;
    }
}

async function inlineImagePreviewData(relativeTo: string, metadata: PostMetadata): Promise<void> {
    if (!metadata.image) return;

    type ImageFormat = "webp" | "avif" | "jpeg";
    const FORMAT: ImageFormat = "avif";
    const MAX_QUALITY: Record<ImageFormat, number> = { webp: 75, avif: 50, jpeg: 80 };
    const PREVIEW_HEIGHT = 240;
    const PREVIEW_BYTES = 4 * 1024;
    const COMPRESSOR: Record<ImageFormat, (image: sharp.Sharp, quality: number) => sharp.Sharp> = {
        webp: (image, quality) =>
            image.webp({
                quality,
                effort: 6,
                smartDeblock: true,
                smartSubsample: true,
                preset: "photo",
            }),
        avif: (image, quality) => image.avif({ quality }),
        jpeg: (image, quality) => image.jpeg({ quality }),
    };

    async function toTiny(image: sharp.Sharp, targetSize: number): Promise<Buffer> {
        let best = undefined;

        let low = 1;
        let high = MAX_QUALITY[FORMAT] + 1;

        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            const tiny = await COMPRESSOR[FORMAT](image, mid).toBuffer();
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
                best = [tiny, mid] as const;
            }
        }

        console.log(best![1], relativeTo);

        return best![0];
    }

    try {
        const imagePath = path.join(relativeTo, decodeURIComponent(metadata.image));
        const cachePath = path.join(
            IMAGE_CACHE_DIR,
            "preview-" +
                (await getImageCacheKey(imagePath, [FORMAT, PREVIEW_HEIGHT, PREVIEW_BYTES])) +
                "." +
                FORMAT,
        );

        let imageBytes;
        if (await fsExists(cachePath)) {
            imageBytes = await fs.readFile(cachePath);
        } else {
            const img = sharp(imagePath);
            const resizedImage = img.resize({
                height: PREVIEW_HEIGHT,
                fit: "outside",
            });
            const tiny = await toTiny(resizedImage, PREVIEW_BYTES);

            await fs.mkdir(IMAGE_CACHE_DIR, { recursive: true });
            await fs.writeFile(cachePath, tiny as never);

            imageBytes = tiny;
        }

        metadata.imageInlinePreviewData = toBase64Image(imageBytes, FORMAT);
    } catch (e) {
        console.error(`Error inlining image load for ${metadata.image}:`, e);
        metadata.imageInlinePreviewData = undefined;
    }
}
async function getImageCacheKey(imagePath: string, other: Iterable<unknown> = []): Promise<string> {
    // I'm using the file size as a proxy for the content hash.
    // Not perfect, but very fast.
    const fileSize = await fs.stat(imagePath).then((stat) => stat.size);

    const hash = crypto.createHash("sha256");
    hash.update(fileSize.toString());
    hash.update(";");
    hash.update(imagePath);
    for (const o of other) {
        hash.update(";");
        hash.update(String(o));
    }
    return hash.digest("hex").slice(0, 8);
}

function getMinutesToRead(markdown: string): number {
    const words = markdown.split(/\s+/).length;
    return Math.ceil(words / 200);
}

function getMarkdownHeader(content: string): string {
    const header = /^# (.+)/m.exec(content);
    return header?.[1] ?? "No title found";
}

function getPostColor(slug: string): string {
    // hash the slug and pick a random color based on it
    const hash = crypto.createHash("sha256").update(slug).digest("hex");
    // derive 3 random numbers from the hash
    const r1 = parseInt(hash.slice(0, 4), 16) / 65535;
    const r2 = parseInt(hash.slice(4, 8), 16) / 65535;
    const r3 = parseInt(hash.slice(8, 12), 16) / 65535;

    const mix = (a: number, b: number, mix: number) => a * (1 - mix) + b * mix;

    const h = Math.round(mix(0, 360, r1));
    const s = Math.round(mix(65, 85, r2));
    const v = Math.round(mix(90, 95, r3));

    const rgb = hsv2rgb(h, s / 100, v / 100);

    return rgb;
}

function hsv2rgb(h: number, s: number, v: number) {
    const f = (n: number, k = (n + h / 60) % 6) => v - v * s * Math.max(Math.min(k, 4 - k, 1), 0);
    const rgb = [f(5), f(3), f(1)] as const;
    return `rgb(${rgb.map((c) => Math.round(c * 255))})`;
}

function getImageUrls(md: string): string[] {
    md = removeMdCodeBlocks(md);

    const imageRegex = /!\[[^[\]\r\n]*\]\(([^\r\n()]*)\)/g;
    const images: string[] = [];
    let match;
    while ((match = imageRegex.exec(md))) {
        images.push(match[1]);
    }
    return images;
}

function removeMdCodeBlocks(md: string): string {
    return md.replace(/^```.*\n[^]*?^```/gm, "");
}
