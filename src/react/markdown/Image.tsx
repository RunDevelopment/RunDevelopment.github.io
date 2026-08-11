import { parseMetaString } from "./md-util";
import "./Image.css";

interface ImageProps {
    src?: string | Blob;
    alt?: string;
    width?: number;
    height?: number;
}
export function Image({ src, alt = "Image", width, height }: ImageProps) {
    const metaString = alt.match(/(?:^|\s)@[\w-][\s\S]*$/)?.[0] ?? "";
    alt = alt.slice(0, alt.length - metaString.length).trim();
    const meta = parseMetaString(metaString);

    let maxWidth = meta["max-width"] as string | undefined;
    if (meta.wide) maxWidth ||= "100%";
    if (meta.narrow) maxWidth ||= "480px";
    maxWidth ||= "var(--page-width)";

    if (src && typeof src !== "string") {
        src = URL.createObjectURL(src);
    }

    return (
        <div className="ImageWrapper" data-wide>
            <img
                src={src}
                alt={alt}
                width={width}
                height={height}
                style={{ "--max-width": maxWidth } as React.CSSProperties}
                data-max-width={maxWidth}
                loading="lazy"
            />
        </div>
    );
}
