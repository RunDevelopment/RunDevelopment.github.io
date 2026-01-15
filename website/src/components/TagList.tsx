import Link from "next/link";

interface TagButtonProps {
    tag: string;
    onClick: () => void;
    selected: boolean;
}
export function TagButton({ tag, onClick, selected = false }: TagButtonProps) {
    return (
        <button
            className="cursor-pointer rounded bg-slate-800 px-2 py-1 text-blue-300 transition-colors hover:text-blue-100 data-[selected]:bg-slate-700 data-[selected]:text-blue-100"
            onClick={onClick}
            data-selected={selected || undefined}
        >
            #{tag}
        </button>
    );
}

interface TagLinkProps {
    tag: string;
}
export function TagLink({ tag }: TagLinkProps) {
    return (
        <Link
            className="rounded bg-slate-800 px-2 py-1 text-blue-300"
            href={`/blog#${encodeURIComponent(tag)}`}
        >
            #{tag}
        </Link>
    );
}

interface TagListProps {
    tags: readonly string[];
}
export function TagLinkList({ tags }: TagListProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
                <TagLink key={tag} tag={tag} />
            ))}
        </div>
    );
}
