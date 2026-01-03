import { memo } from "react";
import { Post, PostMetadata } from "../../../lib/schema";
import { Markdown } from "../../../components/md/Markdown";
import { TagList } from "../../../components/TagList";
import { formatDateString } from "../../../lib/util";
import { OpenDetailsOnPrint } from "../../../components/DetailOpener";
import { BaseArticle } from "../../../components/md/BaseArticle";
import "./Article.css";

function AfterHeader({ meta }: { meta: PostMetadata }) {
    return (
        <div className="my-8 text-sm text-zinc-400">
            <div className="flex items-center justify-center">
                <TagList tags={meta.tags} />
            </div>

            <p className="mt-2 flex flex-col items-center justify-center text-center text-sm xs:block">
                <span className="whitespace-nowrap">Michael Schmidt</span>
                <span className="hidden px-2 xs:inline">{" / "}</span>
                <span className="whitespace-nowrap">
                    {formatDateString(meta.datePublished)}
                    {meta.dateModified !== meta.datePublished && (
                        <span className="italic">
                            {" "}
                            (Updated {formatDateString(meta.dateModified)})
                        </span>
                    )}
                </span>
                <span className="hidden px-2 xs:inline">{" / "}</span>
                <span className="whitespace-nowrap">{meta.minutesToRead} min read</span>
            </p>
        </div>
    );
}

function BackgroundImage({ image, inlineData }: { image: string; inlineData?: string }) {
    return (
        <div
            className="relative inset-x-0 z-0 -mx-4 overflow-hidden bg-center sm:absolute sm:mx-0"
            style={{
                backgroundImage: inlineData ? `url('${inlineData}')` : undefined,
                backgroundSize: "auto 100%",
            }}
            aria-hidden
        >
            <div
                className="pointer-events-none absolute bottom-0 hidden size-full sm:block"
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
        ? "sm:h-[var(--bg-image-height)] lg:h-[calc(var(--bg-image-height)-0.5rem)]"
        : "h-auto mt-12";
    const headerFont =
        "font-header text-3xl sm:text-4xl md:text-5xl lg:text-6xl sm:font-light !leading-snug text-balance text-center";

    return (
        <>
            {post.metadata.image && (
                <BackgroundImage
                    image={post.metadata.image}
                    inlineData={post.metadata.imageInlinePreviewData}
                />
            )}
            <BaseArticle>
                <div
                    className="-mx-4 mb-8 block h-4 sm:hidden"
                    style={{
                        background: post.metadata.color,
                    }}
                ></div>
                <div className={headerContainerHeight + " flex flex-col justify-end text-center"}>
                    <div className="relative sm:overflow-hidden" id="title-container">
                        <div
                            className="hidden h-0 contain-size contain-layout sm:block"
                            aria-hidden
                        >
                            <div
                                className={headerFont + " relative z-0 text-transparent opacity-80"}
                            >
                                <span className="bg-black box-decoration-clone px-4 py-2">
                                    {post.metadata.title}
                                </span>
                            </div>
                        </div>

                        <h1
                            className={
                                headerFont + " relative z-10 my-0 text-white print:text-black"
                            }
                        >
                            <span className="box-decoration-clone sm:px-4 sm:py-2">
                                {post.metadata.title}
                            </span>
                        </h1>
                    </div>
                </div>
                <div
                    className="-mx-4 hidden h-4 sm:block md:-mx-6 lg:mx-0 lg:rounded-xl"
                    style={{
                        background: post.metadata.color,
                    }}
                ></div>
                <AfterHeader meta={post.metadata} />
                <Markdown
                    markdown={post.markdown}
                    inlineCodeLanguage={post.metadata.inlineCodeLanguage}
                    draft={post.metadata.draft}
                    noH1
                    getImageUrl={post.imageUrlMapping}
                    imageSizes={post.imageSizes}
                />
                <OpenDetailsOnPrint />
            </BaseArticle>
        </>
    );
});
