import path from "path";
import fs from "fs/promises";
import YAML from "yaml";
import { InternalPostId, Post, PostMetadata } from "../schema";
import { timedCached } from "../util";
import crypto from "crypto";

const POST_DIR = path.join(process.cwd(), "../posts");

export const getPosts = timedCached(2000, async () => {
    const postFiles = await fs.readdir(POST_DIR, {
        encoding: "utf-8",
        recursive: true,
    });
    // find all markdown files in POST_DIR
    const postIds = postFiles
        .filter((file) => file.endsWith(".md"))
        .map((file) => file as InternalPostId);

    return Promise.all(postIds.map(getPost));
});

export const getPostFromSlug = async (slug: string): Promise<Post | undefined> => {
    const posts = await getPosts();
    return posts.find((post) => post.metadata.slug === slug);
};

export const getPost = timedCached(2000, async (id: InternalPostId): Promise<Post> => {
    const filePath = path.join(POST_DIR, id);
    const content = await fs.readFile(filePath, { encoding: "utf-8" });

    let frontMatter = undefined;
    let markdown = content;
    if (content.startsWith("---")) {
        const frontMatterEnd = content.indexOf("\n---\n");
        frontMatter = YAML.parse(content.slice(4, frontMatterEnd)) as FrontMatter;
        markdown = content.slice(frontMatterEnd + 5);
    }

    const metadata = getMetadata(frontMatter ?? {}, markdown);
    console.log(metadata);
    return { id, metadata, markdown };
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
        minutesToRead,
    };
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
