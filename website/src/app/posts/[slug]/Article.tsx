import { memo } from "react";
import { Post } from "../../../lib/schema";
import { Markdown } from "../../../components/md/Markdown";

interface ArticleProps {
    post: Post;
}
export const Article = memo(({ post }: ArticleProps) => {
    const date = new Date(Date.parse(post.metadata.datePublished));
    const dateStr = `${date.toLocaleString("en-us", { month: "long" })} ${date.getUTCDate()}, ${date.getUTCFullYear()}`;

    const afterHeader = (
        <>
            <p className="-mt-4 mb-6 text-sm text-zinc-400">
                <span>{dateStr}</span>
                <span className="px-2">-</span>
                <span>{post.metadata.minutesToRead} min read</span>
            </p>
        </>
    );

    return (
        <article className="text-[15px] md:text-base">
            <Markdown
                code={post.markdown}
                inlineCodeLanguage={post.metadata.inlineCodeLanguage}
                draft={post.metadata.draft}
                afterHeader={afterHeader}
            />
        </article>
    );
});
