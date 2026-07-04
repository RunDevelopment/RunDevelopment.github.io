import { memo } from "react";
import { PostMetadata } from "../lib/schema";
import Link from "next/link";
import { formatDateString } from "../lib/util";
import { FancyText } from "./FancyText";

export interface PostCardProps {
    meta: PostMetadata;
    showYear?: boolean;
}
export const PostCard = memo(({ meta, showYear = false }: PostCardProps) => {
    const href = `/blog/${meta.slug}`;

    return (
        <div className="my-4 flex flex-row gap-4 -mr-1">
            <span
                className="block w-4 shrink-0 rounded-xl -my-0.5"
                tabIndex={-1}
                style={{ background: meta.color }}
            />
            <div>
                <h3>
                    <Link
                        href={href}
                        className="line-clamp-2 text-lg leading-tight text-blue-300 transition-colors hover:text-blue-400 md:line-clamp-1"
                    >
                        <FancyText text={meta.title} />
                        {meta.draft && " [DRAFT]"}
                    </Link>
                </h3>
                <p className="mt-1 text-sm text-zinc-400">
                    <span>{formatDateString(meta.datePublished, showYear)}</span>
                    <span className="px-2">-</span>
                    <span>{meta.minutesToRead} min read</span>
                </p>
                <p className="mt-0.5 line-clamp-3 text-pretty leading-snug">
                    <FancyText text={meta.description} />
                </p>
            </div>
        </div>
    );
});
