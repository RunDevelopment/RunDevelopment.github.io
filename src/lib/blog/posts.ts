import { type CollectionEntry, getCollection } from "astro:content";
import { IS_DEV } from "../config";
import { groupBy } from "../util";
import { type PostMetadata, toPostMetadata } from "./schema";

export interface BlogPosts {
    posts: readonly PostMetadata[];
    collectionEntries: readonly CollectionEntry<"blog">[];
    byYear: [number, readonly PostMetadata[]][];
    tags: ReadonlyMap<string, number>;
}

export async function getBlogPosts(): Promise<BlogPosts> {
    const rawCollectionEntries = (await getCollection("blog")).filter(
        (e) => IS_DEV || !e.data.draft,
    );

    const entries = rawCollectionEntries
        .filter((e) => IS_DEV || !e.data.draft)
        .map((e) => [e, toPostMetadata(e)] as const)
        .sort((a, b) => {
            const dateA = new Date(a[1].datePublished);
            const dateB = new Date(b[1].datePublished);
            return dateB.getTime() - dateA.getTime();
        });

    const collectionEntries = entries.map(([entry, _]) => entry);
    const posts = entries.map(([_, metadata]) => metadata);

    const byYearMap = groupBy(posts, (post) => new Date(post.datePublished).getFullYear());
    const byYear = Array.from(byYearMap.entries());

    const tags = new Map<string, number>();
    for (const post of posts) {
        for (const tag of post.tags) {
            tags.set(tag, (tags.get(tag) ?? 0) + 1);
        }
    }

    return { posts, collectionEntries, byYear, tags };
}
