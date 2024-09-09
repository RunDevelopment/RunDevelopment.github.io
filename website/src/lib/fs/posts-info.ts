import { getPosts } from "./uptodate";
import { PostMetadata } from "../schema";
import { cachedWeak } from "../util";

export interface PostsInfo {
    byYear: [year: number, posts: PostMetadata[]][];
    allTags: string[];
}

export async function getPostsInfo(): Promise<PostsInfo> {
    const posts = (await getPosts()).map((post) => post.metadata);

    const now = new Date();
    const getPostDate = cachedWeak((post: PostMetadata) => {
        const parsed = Date.parse(post.datePublished);
        if (Number.isNaN(parsed)) {
            return now;
        }
        return new Date(parsed);
    });

    posts.sort((a, b) => getPostDate(b).getTime() - getPostDate(a).getTime());

    const byYearMap = new Map<number, PostMetadata[]>();
    for (const post of posts) {
        const year = new Date(post.datePublished).getFullYear();
        const posts = byYearMap.get(year) ?? [];
        posts.push(post);
        byYearMap.set(year, posts);
    }
    const byYear = Array.from(byYearMap.entries()).sort(([a], [b]) => b - a);

    const allTags = [...new Set<string>(posts.flatMap((post) => post.tags))].sort();

    return { byYear, allTags };
}
