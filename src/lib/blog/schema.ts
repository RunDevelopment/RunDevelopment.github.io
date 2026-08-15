import type { CollectionEntry } from "astro:content";
import crypto from "node:crypto";
import { Rgb } from "../color";

export type BlogCollectionEntry = CollectionEntry<"blog">;

export interface PostMetadata {
    title: string;
    description: string;
    datePublished: string;
    dateModified: string;
    draft: boolean;
    inlineCodeLanguage?: string;
    slug: string;
    tags: string[];
    minutesToRead: number;
    accent: string;
    image?: string;
    imageInlineData?: string;
    imageFadeColor?: string;
}

export function toPostMetadata(entry: BlogCollectionEntry): PostMetadata {
    const slug = getSlug(entry);
    const accent = entry.data.accent ?? getPostAccentColor(slug);

    return {
        title: entry.data.title,
        description: entry.data.description,
        datePublished: entry.data.datePublished,
        dateModified: entry.data.dateModified || entry.data.datePublished,
        draft: entry.data.draft,
        inlineCodeLanguage: entry.data.inlineCodeLanguage,
        slug,
        tags: entry.data.tags
            .split(" ")
            .map((t) => t.trim())
            .filter(Boolean)
            .sort(),
        minutesToRead: getMinutesToRead(entry.body || ""),
        accent,
        image: entry.data.image,
        imageFadeColor: entry.data.imageFadeColor,
    };
}

function getMinutesToRead(markdown: string): number {
    const words = markdown.split(/\s+/).length;
    return Math.ceil(words / 200);
}

function getSlug(entry: BlogCollectionEntry): string {
    return (
        entry.data.slug ??
        entry.data.title
            .toLowerCase()
            .replace(/[:'"()$^<>]/g, "")
            .replace(/\s+/g, "-")
    );
}

function getPostAccentColor(slug: string): string {
    // hash the slug and pick a random color based on it
    const hash = crypto.createHash("sha256").update(slug).digest("hex");
    // derive 3 random numbers from the hash
    const r1 = parseInt(hash.slice(0, 4), 16) / 65535;
    const r2 = parseInt(hash.slice(4, 8), 16) / 65535;
    const r3 = parseInt(hash.slice(8, 12), 16) / 65535;

    const mix = (a: number, b: number, mix: number) => a * (1 - mix) + b * mix;

    const h = mix(0, 360, r1);
    const s = mix(0.65, 0.85, r2);
    const v = mix(0.9, 0.95, r3);

    return Rgb.fromHsv(h, s, v).toCss();
}
