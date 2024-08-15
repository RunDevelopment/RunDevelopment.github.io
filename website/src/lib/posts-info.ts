import { getPosts } from "./fs/uptodate";
import { Post } from "./schema";
import { cachedWeak } from "./util";

export interface PostsInfo {
    byYear: [year: number, posts: Post[]][];
    allTags: string[];
}

export async function getPostsInfo(): Promise<PostsInfo> {
    const posts = await getPosts();

    const now = new Date();
    const getPostDate = cachedWeak((post: Post) => {
        const parsed = Date.parse(post.metadata.datePublished);
        if (Number.isNaN(parsed)) {
            return now;
        }
        return new Date(parsed);
    });

    posts.sort((a, b) => getPostDate(b).getTime() - getPostDate(a).getTime());

    const byYearMap = new Map<number, Post[]>();
    for (const post of posts) {
        const year = new Date(post.metadata.datePublished).getFullYear();
        const posts = byYearMap.get(year) ?? [];
        posts.push(post);
        byYearMap.set(year, posts);
    }
    const byYear = Array.from(byYearMap.entries()).sort(([a], [b]) => b - a);

    const allTags = [...new Set<string>(posts.flatMap((post) => post.metadata.tags))].sort();

    return { byYear, allTags };
}
