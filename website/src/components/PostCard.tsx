import { memo } from "react";
import { PostMetadata } from "../lib/schema";
import Link from "next/link";
import { formatDateString } from "../lib/util";

export interface PostCardProps {
    meta: PostMetadata;
    showYear?: boolean;
}
export const PostCard = memo(({ meta, showYear = false }: PostCardProps) => {
    const href = `/blog/${meta.slug}`;

    return (
        <div className="my-4 flex flex-row gap-4 ">
            <Link
                href={href}
                className="block w-20 shrink-0 overflow-hidden rounded-xl pb-5 transition-all hover:brightness-75"
                tabIndex={-1}
                style={{ background: meta.color }}
            >
                {meta.imageSmall && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={meta.imageSmall}
                        alt="cover image"
                        className="size-full object-cover contain-size"
                    />
                )}
            </Link>
            <div>
                <h3>
                    <Link
                        href={href}
                        className="line-clamp-2 text-base text-blue-300 transition-colors hover:text-blue-400 md:line-clamp-1 md:text-lg"
                    >
                        {meta.title}
                        {meta.draft && " [DRAFT]"}
                    </Link>
                </h3>
                <p className="mt-1 line-clamp-1 text-xs text-zinc-400 md:text-sm">
                    <span>{formatDateString(meta.datePublished, showYear)}</span>
                    {meta.dateModified !== meta.datePublished && (
                        <span className="italic">
                            {" "}
                            (Updated {formatDateString(meta.dateModified)})
                        </span>
                    )}
                    <span className="px-2">-</span>
                    <span>{meta.minutesToRead} min read</span>
                </p>
                <p className="line-clamp-1 text-sm md:text-base">{meta.description}</p>
            </div>
        </div>
    );
});
