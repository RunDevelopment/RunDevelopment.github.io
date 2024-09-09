import { memo } from "react";
import { Post, PostMetadata } from "../../../lib/schema";
import { Markdown } from "../../../components/md/Markdown";
import { TagList } from "../../../components/TagList";
import { formatDateString } from "../../../lib/util";

function AfterHeader({ meta }: { meta: PostMetadata }) {
    return (
        <div className="-mt-4 mb-6 text-sm text-zinc-400">
            <p className="mb-2 text-center text-sm text-zinc-400">
                <span>{formatDateString(meta.datePublished)}</span>
                {meta.dateModified !== meta.datePublished && (
                    <span className="italic"> (Updated {formatDateString(meta.dateModified)})</span>
                )}
                <span className="px-2">-</span>
                <span>{meta.minutesToRead} min read</span>
            </p>

            <div className="flex items-center justify-center">
                <TagList tags={meta.tags} />
            </div>

            <div
                className="-mx-4 mb-8 mt-6 overflow-hidden pb-4 md:-mx-6 lg:mx-0 lg:rounded-xl"
                style={{
                    background: meta.color,
                }}
            >
                {
                    // eslint-disable-next-line @next/next/no-img-element
                    meta.image && <img src={meta.image} alt="Cover image" className="w-full" />
                }
            </div>
        </div>
    );
}

interface ArticleProps {
    post: Post;
}
export const Article = memo(({ post }: ArticleProps) => {
    return (
        <article className="narrow-container mt-8 break-normal text-[17px] leading-normal md:leading-normal print:text-[14px] print:leading-5">
            <Markdown
                code={post.markdown}
                inlineCodeLanguage={post.metadata.inlineCodeLanguage}
                draft={post.metadata.draft}
                afterHeader={<AfterHeader meta={post.metadata} />}
                getImageUrl={post.imageUrlMapping}
            />
        </article>
    );
});
