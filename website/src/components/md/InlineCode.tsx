import { memo } from "react";
import { SyntaxHighlight } from "./SyntaxHighlight";

interface HighlightInlineCodeProps {
    code: string;
    lang: string | undefined;
    className?: string;
}
const CSS_COLOR_RE = /^(?:#[a-f0-9]{3}|#[a-f0-9]{6}|(?:rgb|hsl|hsv)a?\([ ,0-9%deg]+\))$/i;
const HighlightInlineCode = memo(({ code, className, lang }: HighlightInlineCodeProps) => {
    if (CSS_COLOR_RE.test(code)) {
        // show colors inline
        return (
            <code className={"language-css " + className}>
                <span
                    style={{ backgroundColor: code }}
                    className="mb-0.5 mr-1 inline-block size-3 border border-white align-middle"
                />
                <SyntaxHighlight code={code} noCodeElement lang="css" />
            </code>
        );
    }

    if (lang) {
        return (
            <code className={className}>
                <SyntaxHighlight code={code} noCodeElement lang={lang} />
            </code>
        );
    } else {
        return <code className={className}>{code}</code>;
    }
});
interface InlineCodeProps {
    code: string;
    lang?: string;
    smaller?: boolean;
}

export const InlineCode = memo(({ code, lang, smaller }: InlineCodeProps) => {
    const short = code.length < 20;
    return (
        <HighlightInlineCode
            className={
                (short ? "whitespace-pre" : "md:whitespace-pre") +
                (smaller ? " text-[93.75%]" : "") +
                " rounded-md bg-zinc-950 px-2 py-0.5"
            }
            lang={lang}
            code={code}
        />
    );
});
