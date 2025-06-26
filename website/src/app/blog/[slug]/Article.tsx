import { memo } from "react";
import { Post, PostMetadata } from "../../../lib/schema";
import { Markdown } from "../../../components/md/Markdown";
import { TagList } from "../../../components/TagList";
import { formatDateString } from "../../../lib/util";
import { OpenDetailsOnPrint } from "../../../components/DetailOpener";
import "./Article.css";

function AfterHeader({ meta }: { meta: PostMetadata }) {
    return (
        <div className="my-8 text-sm text-zinc-400">
            <div className="flex items-center justify-center">
                <TagList tags={meta.tags} />
            </div>

            <p className="mt-2 flex flex-col items-center justify-center text-center text-sm sm:block">
                <span className="whitespace-nowrap">Michael Schmidt</span>
                <span className="hidden px-2 sm:inline">{" / "}</span>
                <span className="whitespace-nowrap">
                    {formatDateString(meta.datePublished)}
                    {meta.dateModified !== meta.datePublished && (
                        <span className="italic">
                            {" "}
                            (Updated {formatDateString(meta.dateModified)})
                        </span>
                    )}
                </span>
                <span className="hidden px-2 sm:inline">{" / "}</span>
                <span className="whitespace-nowrap">{meta.minutesToRead} min read</span>
            </p>
        </div>
    );
}

function BackgroundImage({ image }: { image: string }) {
    return (
        <div className="absolute inset-x-0 z-0 overflow-hidden">
            <div className="pointer-events-none absolute bottom-0 size-full" id="bg-img-fade" />

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
        ? "h-[var(--bg-image-height)] lg:h-[calc(var(--bg-image-height)-0.5rem)]"
        : "h-auto mt-12";
    return (
        <>
            {post.metadata.image && <BackgroundImage image={post.metadata.image} />}
            <article className="narrow-container xs:text-[17px] relative z-[1] text-pretty break-normal text-[16px] leading-relaxed print:text-[14px] print:leading-snug print:text-black">
                <div className={headerContainerHeight + " flex flex-col justify-end text-center"}>
                    <div className="relative mb-2" id="title-contianer">
                        <div className="h-0 contain-size contain-layout" aria-hidden>
                            <div className="font-header relative z-0 text-balance text-center text-3xl !leading-snug text-transparent opacity-50 md:text-4xl lg:text-5xl">
                                <span className="bg-zinc-900 box-decoration-clone px-4 py-2">
                                    {post.metadata.title}
                                </span>
                            </div>
                        </div>

                        <h1 className="font-header relative z-10 my-0 text-balance text-center text-3xl !leading-snug text-white md:text-4xl lg:text-5xl print:text-black">
                            <span className="box-decoration-clone px-4 py-2">
                                {post.metadata.title}
                            </span>
                        </h1>
                    </div>
                </div>
                <div
                    className="-mx-4 h-4 md:-mx-6 lg:mx-0 lg:rounded-xl"
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
            </article>
        </>
    );
});
