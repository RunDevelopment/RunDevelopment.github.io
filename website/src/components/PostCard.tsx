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
        <div className="my-4 flex h-24 flex-row gap-4 sm:h-20">
            <Link
                href={href}
                className="block w-20 shrink-0 overflow-hidden rounded-xl pb-2 transition-all hover:brightness-75"
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
            <div className="overflow-hidden">
                <h3>
                    <Link
                        href={href}
                        className="line-clamp-2 text-lg leading-tight text-blue-300 transition-colors hover:text-blue-400 md:line-clamp-1"
                    >
                        {meta.title}
                        {meta.draft && " [DRAFT]"}
                    </Link>
                </h3>
                <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
                    <span>{formatDateString(meta.datePublished, showYear)}</span>
                    {meta.dateModified !== meta.datePublished && (
                        <span className="italic">
                            {" "}
                            (updated {formatDateString(meta.dateModified)})
                        </span>
                    )}
                    <span className="px-2">-</span>
                    <span>{meta.minutesToRead} min read</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-pretty leading-snug">{meta.description}</p>
            </div>
        </div>
    );
});
