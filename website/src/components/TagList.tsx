interface TagViewProps {
    tag: string;
    onClick?: () => void;
    selected?: boolean;
}
export function TagView({ tag, onClick, selected = false }: TagViewProps) {
    if (!onClick && !selected) {
        return <span className="rounded bg-slate-800 px-2 py-1 text-blue-300">#{tag}</span>;
    }
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

interface TagListProps {
    tags: readonly string[];
}
export function TagList({ tags }: TagListProps) {
    return (
        <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
                <TagView key={tag} tag={tag} />
            ))}
        </div>
    );
}
