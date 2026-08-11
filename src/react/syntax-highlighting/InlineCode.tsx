import { highlight } from "./prism";
import "./theme.css";
import "./InlineCode.css";

const CSS_COLOR_RE =
    /^(?:#(?:[a-f0-9]{3,4}|[a-f0-9]{6}|[a-f0-9]{8})|(?:rgb|hsl|lab|lch|oklab|oklch|p3)a?\([ ,0-9%deg./]+\))$/i;

interface InlineCodeProps {
    code: string;
    lang: string;
}
export function InlineCode({ code, lang }: InlineCodeProps) {
    let before = "";

    if (CSS_COLOR_RE.test(code)) {
        lang = "css";
        before = `<span class="InlineColor" style="--color:${code}"></span>`;
    }

    return (
        <code
            className={`InlineCode language-${lang}`}
            data-short={code.length < 20 || undefined}
            dangerouslySetInnerHTML={{ __html: before + highlight(code, lang) }}
        />
    );
}
