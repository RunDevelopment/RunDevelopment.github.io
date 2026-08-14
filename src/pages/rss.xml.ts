import rss, { type RSSFeedItem } from "@astrojs/rss";
import { getBlogPosts } from "../lib/blog/posts";
import { capitalize } from "../lib/util";

export async function GET() {
    const { posts } = await getBlogPosts();
    const site = import.meta.env.SITE;
    return rss({
        title: "RunDev's Blog",
        description:
            "Blog posts by Michael Schmidt (aka RunDev) about software, programming, and others.",
        site,
        items: posts.map(
            (post): RSSFeedItem => ({
                title: post.title,
                description: post.description,
                pubDate: new Date(post.datePublished),
                categories: post.tags.map((tag) => capitalize(tag.toLowerCase())),
                author: "Michael Schmidt",
                link: `${site}/blog/${post.slug}/`,
            }),
        ),
    });
}
