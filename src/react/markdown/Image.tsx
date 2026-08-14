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

    // add a scoped style to remove border-radius if the image touches the edge of the screen
    let scopedCss;
    if (width) {
        const WIDE_MAX_WIDTH = 1024;
        const PAGE_WIDTH = 720;
        const parsedMaxWidth = /^\d+px$/.test(maxWidth)
            ? parseInt(maxWidth.slice(0, -2), 10)
            : maxWidth === "100%"
              ? WIDE_MAX_WIDTH
              : maxWidth === "var(--page-width)"
                ? PAGE_WIDTH
                : undefined;
        if (parsedMaxWidth) {
            const breakpoint = Math.min(parsedMaxWidth, width);
            scopedCss = `@scope{@media (width < ${breakpoint}px){img{border-radius:0 !important;}}}`;
        }
    }

    return (
        <div className="ImageWrapper" data-wide>
            <img
                src={src}
                alt={alt}
                width={width}
                height={height}
                style={{ "--max-width": maxWidth } as React.CSSProperties}
                loading="lazy"
            />
            {scopedCss && <style>{scopedCss}</style>}
        </div>
    );
}
