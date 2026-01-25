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

    const modifiedSameYear = areSameYear(meta.datePublished, meta.dateModified) ?? false;

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
                        className="size-full bg-cover bg-center object-cover contain-size"
                        style={
                            meta.imageSmallInlinePreviewData
                                ? { backgroundImage: `url(${meta.imageSmallInlinePreviewData})` }
                                : undefined
                        }
                    />
                )}
            </Link>
            <div className="overflow-hidden">
                <h3>
                    <Link
                        href={href}
                        className="line-clamp-2 text-lg leading-tight text-blue-300 transition-colors hover:text-blue-400 md:line-clamp-1"
                    >
                        <FancyText text={meta.title} />
                        {meta.draft && " [DRAFT]"}
                    </Link>
                </h3>
                <p className="mt-1 line-clamp-1 text-sm text-zinc-400">
                    <span>{formatDateString(meta.datePublished, showYear)}</span>
                    {meta.dateModified !== meta.datePublished && (
                        <span className="italic">
                            {" "}
                            (mod: {formatDateString(meta.dateModified, !modifiedSameYear)})
                        </span>
                    )}
                    <span className="px-2">-</span>
                    <span>{meta.minutesToRead} min read</span>
                </p>
                <p className="mt-0.5 line-clamp-2 text-pretty leading-snug">
                    <FancyText text={meta.description} />
                </p>
            </div>
        </div>
    );
});

function areSameYear(dateA: string, dateB: string): boolean | undefined {
    const a = Date.parse(dateA);
    const b = Date.parse(dateB);
    if (Number.isNaN(a) || Number.isNaN(b)) {
        return undefined;
    }

    return new Date(a).getFullYear() === new Date(b).getFullYear();
}
