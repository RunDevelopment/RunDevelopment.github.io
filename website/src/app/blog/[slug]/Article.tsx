import { memo } from "react";
import { Post, PostMetadata } from "../../../lib/schema";
import { Markdown } from "../../../components/md/Markdown";
import { TagLinkList } from "../../../components/TagList";
import { formatDateString } from "../../../lib/util";
import { OpenDetailsOnPrint } from "../../../components/DetailOpener";
import { BaseArticle } from "../../../components/md/BaseArticle";
import { FancyText } from "../../../components/FancyText";
import "./Article.css";
import { BalanceBox } from "../../../components/BalanceBox";

function AfterHeader({ meta }: { meta: PostMetadata }) {
    return (
        <div className="mt-6 mb-8 sm:mt-8 text-sm text-zinc-400">
            <p className="mb-2 text-center text-xs sm:text-sm block">
                <span className="whitespace-nowrap">Michael Schmidt</span>
                <span className="px-2">{" / "}</span>
                <span className="whitespace-nowrap">{meta.minutesToRead} min read</span>
                <span className="px-2">{" / "}</span>
                <span className="whitespace-nowrap">
                    {formatDateString(meta.datePublished)}
                    {meta.dateModified !== meta.datePublished && (
                        <span className="italic">
                            {" "}
                            (mod: {formatDateString(meta.dateModified)})
                        </span>
                    )}
                </span>
            </p>

            <div className="flex items-center justify-center">
                <TagLinkList tags={meta.tags} />
            </div>
        </div>
    );
}

function BackgroundImage({
    image,
    fadeColor = "black",
    inlineData,
}: {
    image: string;
    fadeColor?: string;
    inlineData?: string;
}) {
    return (
        <div
            className="relative inset-x-0 z-0 -mx-4 overflow-hidden bg-center sm:absolute sm:mx-0 print:hidden"
            style={
                {
                    "--bg-inline": inlineData ? `url('${inlineData}')` : "none",
                    "--fade-color": fadeColor,
                } as React.CSSProperties
            }
            aria-hidden
            id="bg-img-container"
        >
            <div
                className="pointer-events-none absolute bottom-0 hidden size-full lg:block"
                id="bg-img-fade"
            />

            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={image}
                alt="Cover image"
                className="mx-auto h-[var(--bg-image-height)] object-cover"
            />
        </div>
    );
}

interface ArticleProps {
    post: Post;
}
export const Article = memo(({ post }: ArticleProps) => {
    const headerContainerHeight = post.metadata.image
        ? "sm:h-[var(--bg-image-height)] lg:h-[calc(var(--bg-image-height)-0.25rem)]"
        : "h-auto mt-12";

    return (
        <BaseArticle>
            {post.metadata.image && (
                <BackgroundImage
                    image={post.metadata.image}
                    fadeColor={post.metadata.imageFadeColor ?? "#0A0D18"}
                    inlineData={post.metadata.imageInlinePreviewData}
                />
            )}
            <div
                className={
                    headerContainerHeight +
                    " hidden sm:flex flex-col justify-end text-center print:hidden"
                }
                aria-hidden
            >
                <div>
                    <span
                        id="bg-text"
                        className="font-header balanced-box inline-block box-decoration-clone text-3xl md:text-4xl lg:text-5xl !leading-[1.125] text-balance text-center box-content relative z-10 my-0 px-5 py-2 md:py-3 backdrop-blur-md text-white bg-black/60"
                    >
                        <FancyText text={post.metadata.title} />
                    </span>
                    <BalanceBox />
                </div>
            </div>
            <div
                className="-mx-4 relative sm:mt-[-1px] z-10 h-1 sm:h-2 md:-mx-6 lg:mx-0 lg:rounded-xl"
                style={{
                    background: post.metadata.color,
                }}
            ></div>
            <div className="narrow mt-8 mb-6 sm:my-0 h-auto print:h-auto sm:h-0 overflow-hidden sm:select-none">
                <h1 className="font-header text-3xl text-balance text-center">
                    <FancyText text={post.metadata.title} />
                </h1>
            </div>
            <AfterHeader meta={post.metadata} />
            <Markdown
                markdown={post.markdown}
                inlineCodeLanguage={post.metadata.inlineCodeLanguage}
                draft={post.metadata.draft}
                getImageUrl={post.imageUrlMapping}
                imageSizes={post.imageSizes}
            />
            <OpenDetailsOnPrint />
        </BaseArticle>
    );
});
