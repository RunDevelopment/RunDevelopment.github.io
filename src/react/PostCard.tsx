import { memo } from "react";
import type { PostMetadata } from "../lib/blog/schema";
import { formatDateString } from "../lib/util";
import { FancyText } from "./FancyText";

export interface PostCardProps {
    meta: PostMetadata;
    showYear?: boolean;
    showTags?: boolean;
}
export const PostCard = memo(({ meta, showYear = false, showTags = false }: PostCardProps) => {
    const href = `/blog/${meta.slug}`;

    return (
        <div className="my-6 -mr-1 flex flex-row gap-4">
            <span
                className="-my-0.5 block w-2 shrink-0 rounded-xl"
                style={{ background: meta.color }}
            />
            <div>
                <h3>
                    <a
                        href={href}
                        className="-mt-1 line-clamp-2 py-1 text-lg leading-tight text-blue-300 transition-colors hover:text-blue-400 md:line-clamp-1"
                    >
                        <FancyText text={meta.title} />
                        {meta.draft && (
                            <span className="text-zinc-300 font-bold font-mono">{" [Draft]"}</span>
                        )}
                    </a>
                </h3>
                <p className="line-clamp-1 text-xs text-zinc-400 xs:text-sm">
                    <span>{formatDateString(meta.datePublished, showYear)}</span>
                    <span className="px-1 opacity-50">{" / "}</span>
                    <span>{meta.minutesToRead} min read</span>
                    {showTags && (
                        <>
                            <span className="px-1 opacity-50">{" / "}</span>
                            <span>{meta.tags.map((t) => "#" + t).join(" ")}</span>
                        </>
                    )}
                </p>
                <p className="mt-1 line-clamp-3 text-pretty leading-snug">
                    <FancyText text={meta.description} />
                </p>
            </div>
        </div>
    );
});
