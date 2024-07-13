import path from "path";
import fs from "fs/promises";
import YAML from "yaml";
import { InternalPostId, Post, PostMetadata } from "../schema";
import { timedCached } from "../util";

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
    datePublished: string;
    dateModified: string;
    draft: boolean;
    inlineCodeLanguage: string;
}

function getMetadata(frontMatter: Partial<FrontMatter>, markdown: string): PostMetadata {
    const title = getMarkdownHeader(markdown);
    const slug =
        frontMatter.slug ??
        title
            .toLowerCase()
            .replace(/[:'"()]/g, "")
            .replace(/\s+/g, "-");

    const datePublished = frontMatter.datePublished ?? "TBD";
    const dateModified = frontMatter.dateModified ?? datePublished;

    const draft = frontMatter.draft ?? false;

    const inlineCodeLanguage = frontMatter.inlineCodeLanguage;

    const minutesToRead = getMinutesToRead(markdown);

    return { title, slug, datePublished, dateModified, draft, inlineCodeLanguage, minutesToRead };
}

function getMinutesToRead(markdown: string): number {
    const words = markdown.split(/\s+/).length;
    return Math.ceil(words / 200);
}

function getMarkdownHeader(content: string): string {
    const header = /^# (.+)/m.exec(content);
    return header?.[1] ?? "No title found";
}
