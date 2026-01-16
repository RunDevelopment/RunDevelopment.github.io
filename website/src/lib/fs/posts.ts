import path from "path";
import fs from "fs/promises";
import YAML from "yaml";
import { ImageSize, InternalPostId, PostMetadata, PostWithInternals } from "../schema";
import { timedCached } from "../util";
import crypto from "crypto";
import { IS_DEV, POST_DIR } from "./config";
import sizeOf from "image-size";
import { promisify } from "util";
import sharp from "sharp";
import { fsExists, toBase64Image } from "./util";
import { cachedImageFile, toTinyImage } from "./image";

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

    // generate cover image
    if (metadata.image) {
        const imagePath = path.join(fileDir, decodeURIComponent(metadata.image));
        metadata.image = await generateCoverImage(imagePath);
    }
    if (metadata.image) {
        metadata.imageInlinePreviewData = await generateInlineImagePreviewData(metadata.image);
    }

    // image URLs
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
    await Promise.all(
        imageUrls.map(async (url) => {
            // ignore absolute URLs
            if (/^http/.test(url)) return;

            const isFilePath = await fsExists(url);

            const imageFilePath = isFilePath
                ? url
                : path.resolve(path.join(fileDir, decodeURIComponent(url)));
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
        }),
    );

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
    title: string;
    description: string;
    datePublished: string;
    dateModified: string;
    draft: boolean;
    inlineCodeLanguage: string;
    tags: string;
    image: string;
    imageLoad: string;
    imageSmall: string;
    imageFadeColor: string;
    color: string;
}
type PartialNull<T> = {
    [P in keyof T]?: T[P] | null;
};

function getMetadata(frontMatter: PartialNull<FrontMatter>, markdown: string): PostMetadata {
    const title = frontMatter.title ?? "Untitled Post";

    const slug =
        frontMatter.slug ??
        title
            .toLowerCase()
            .replace(/[:'"()$^<>]/g, "")
            .replace(/\s+/g, "-");
    const description = frontMatter.description ?? "No description found";

    const datePublished = frontMatter.datePublished ?? "TBD";
    const dateModified = frontMatter.dateModified ?? datePublished;

    const draft = frontMatter.draft ?? false;

    const inlineCodeLanguage = frontMatter.inlineCodeLanguage ?? undefined;

    const color = frontMatter.color ?? getPostColor(slug);
    const image = frontMatter.image ?? undefined;
    const imageSmall = frontMatter.imageSmall ?? image?.replace(/\.(\w+)$/, "_small.$1");
    const imageFadeColor = frontMatter.imageFadeColor ?? undefined;

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
        imageFadeColor,
        minutesToRead,
    };
}

async function generateCoverImage(imagePath: string): Promise<string | undefined> {
    try {
        // Just use the cover image as is if it's small enough.
        // This is important for the Fast Unorm article.
        const USE_AS_IS_HEURISTIC = 300 * 1024; // 300 KB
        const stat = await fs.stat(imagePath);
        if (stat.size <= USE_AS_IS_HEURISTIC) {
            return imagePath;
        }

        // Resize the image and encode as AVIF.
        const height = 800;
        const width = 4096;
        const quality = 80;

        const name = path
            .basename(imagePath)
            .replace(/\.\w+$/, "")
            .replace(/[^\w\-]/g, "-");

        const cachePath = await cachedImageFile(
            imagePath,
            "cover-" + name + "-#.avif",
            { height, width, quality },
            async (image) => {
                image = image.resize({ width, height, fit: "cover", withoutEnlargement: true });
                return image.avif({ quality }).toBuffer();
            },
        );

        return cachePath;
    } catch (e) {
        console.error(`Error creating cover mage load for ${imagePath}:`, e);
        return undefined;
    }
}

async function generateInlineImagePreviewData(imagePath: string): Promise<string | undefined> {
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
    } catch (e) {
        console.error(`Error inlining image load for ${imagePath}:`, e);
        return undefined;
    }
}

type InlinePreviewOptions = {
    height: number;
    maxBytes: number;
    format: "webp" | "avif" | "jpeg";
    maxQuality: number;
};
async function createInlineImagePreview(
    image: sharp.Sharp,
    options: InlinePreviewOptions,
): Promise<Buffer> {
    async function toTiny(image: sharp.Sharp, targetSize: number): Promise<Buffer> {
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
        fit: "outside",
    });
    return toTiny(resizedImage, options.maxBytes);
}

function getMinutesToRead(markdown: string): number {
    const words = markdown.split(/\s+/).length;
    return Math.ceil(words / 200);
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
