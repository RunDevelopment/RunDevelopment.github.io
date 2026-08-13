import { getLangTitle, highlight } from "./prism";
import "./theme.css";
import "./CodeBlock.css";

interface CodeBlockProps {
    code: string;
    lang: string;
    /** Derived from `lang` by default. Set to `false` to hide the title. */
    langTitle?: string | false;
    wide?: boolean | "auto";
    links?: { text: string; title: string; href: string }[];
}
export function CodeBlock({ code, lang, langTitle, wide = "auto", links = [] }: CodeBlockProps) {
    langTitle ??= getLangTitle(lang);

    if (wide === "auto") {
        // determine wide based on code line length
        const lengths = code
            .split("\n")
            .map((line) => line.length)
            .sort((a, b) => a - b);
        const p = 0.9;
        const threshold = 90;
        const sample = lengths[Math.floor(lengths.length * p)];
        wide = sample > threshold;
    }

    return (
        <div
            className="CodeBlock"
            data-wide={wide || undefined}
            data-title={langTitle || undefined}
        >
            {links.length > 0 && (
                <div className="CodeBlockLinks">
                    {links.map(({ text, title, href }, i) => (
                        <a
                            key={i}
                            href={href}
                            title={title}
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            {text}
                        </a>
                    ))}
                </div>
            )}

            {/** biome-ignore lint/a11y/noNoninteractiveTabindex: focus is necessary for scrolling */}
            <pre tabIndex={0} className={`language-${lang}`}>
                <code
                    className={`language-${lang}`}
                    // biome-ignore lint/security/noDangerouslySetInnerHtml: that's how PrimsJS works
                    dangerouslySetInnerHTML={{ __html: highlight(code, lang) }}
                />
            </pre>
        </div>
    );
}
