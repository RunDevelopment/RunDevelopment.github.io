import { memo } from "react";
import { Post, PostMetadata } from "../../../lib/schema";
import { Markdown } from "../../../components/md/Markdown";
import { TagList } from "../../../components/TagList";
import { formatDateString } from "../../../lib/util";

function AfterHeader({ meta }: { meta: PostMetadata }) {
    return (
        <div className="-mt-4 mb-6 text-sm text-zinc-400">
            <p className="mb-2 text-sm text-zinc-400">
                <span>{formatDateString(meta.datePublished)}</span>
                {meta.dateModified !== meta.datePublished && (
                    <span className="italic"> (Updated {formatDateString(meta.dateModified)})</span>
                )}
                <span className="px-2">-</span>
                <span>{meta.minutesToRead} min read</span>
            </p>

            <TagList tags={meta.tags} />

            <div
                className="-mx-4 mb-8 mt-6 overflow-hidden pb-4 md:mx-0 md:rounded-xl"
                style={{
                    background: meta.color,
                }}
            >
                {meta.image && <img src={meta.image} className="w-full object-cover" />}
            </div>
        </div>
    );
}

interface ArticleProps {
    post: Post;
}
export const Article = memo(({ post }: ArticleProps) => {
    return (
        <article className="mt-8 text-[15px] leading-[1.75] md:text-base md:leading-[1.875]">
            <Markdown
                code={post.markdown}
                inlineCodeLanguage={post.metadata.inlineCodeLanguage}
                draft={post.metadata.draft}
                afterHeader={<AfterHeader meta={post.metadata} />}
            />
        </article>
    );
});
