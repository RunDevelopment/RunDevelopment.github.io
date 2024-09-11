import Link from "next/link";
import React, { memo, ReactNode, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { SyntaxHighlight } from "./SyntaxHighlight";
import { CodeBlock } from "./CodeBlock";
import { CustomComponent } from "./CustomComponents";
import { Components, getAllHeadings } from "../../lib/md-util";
import "katex/dist/katex.min.css";
import { TextLink } from "./TextLink";
import { Empty, ForwardChildren } from "../util";
import { H1, H2, H3, H4 } from "./Headings";

interface HighlightInlineCodeProps {
    children: string;
    className?: string;
    lang: string | undefined;
}
const CSS_COLOR_RE = /^(?:#[a-f0-9]{3}|#[a-f0-9]{6}|(?:rgb|hsl|hsv)a?\([ ,0-9%deg]+\))$/i;
const HighlightInlineCode = memo(({ children, className, lang }: HighlightInlineCodeProps) => {
    if (CSS_COLOR_RE.test(children)) {
        // show colors inline
        return (
            <code className={"language-css " + className}>
                <span
                    style={{ backgroundColor: children }}
                    className="mb-0.5 mr-1 inline-block size-3 border border-white align-middle"
                />
                <SyntaxHighlight code={children} noCodeElement lang="css" />
            </code>
        );
    }

    if (lang) {
        return (
            <code className={className}>
                <SyntaxHighlight code={children} noCodeElement lang={lang} />
            </code>
        );
    } else {
        return <code className={className}>{children}</code>;
    }
});
interface CodeProps {
    children?: ReactNode;
    className?: string;
    inlineCodeLang?: string | undefined;
}
const Code = memo(({ children, className, inlineCodeLang }: CodeProps) => {
    const code = String(children);
    const inline = !code.includes("\n");

    if (inline) {
        const short = code.length < 20;
        return (
            <HighlightInlineCode
                className={
                    (short ? "whitespace-pre" : "md:whitespace-pre") +
                    " rounded-md bg-zinc-950 px-2 py-0.5 text-[90%]"
                }
                lang={inlineCodeLang}
            >
                {code}
            </HighlightInlineCode>
        );
    } else {
        const lang = /\blanguage-([-\w:]+)/.exec(className || "")?.[1];
        if (lang === "json:custom") {
            return <CustomComponent json={code} />;
        } else {
            return <CodeBlock lang={lang} code={code} />;
        }
    }
});

interface TOCProps {
    markdown: string;
    inlineCodeLanguage?: string;
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TOC = memo(({ markdown, inlineCodeLanguage }: TOCProps) => {
    const headings = getAllHeadings(markdown).filter(
        (h) => h.level >= 2 && h.level <= 3 && h.text !== "Contents",
    );

    return (
        <div className="transition-opacity hover:opacity-100 xl:fixed xl:bottom-0 xl:left-[calc(max(0px,50vw-(800px+3rem)/2-320px))] xl:max-h-[calc(100vh-max(0px,100px-var(--scroll-y)))] xl:w-[calc(min(300px,50vw-(800px+3rem)/2-20px))] xl:overflow-y-auto xl:p-4 xl:pl-6 xl:opacity-50 xl:focus-within:opacity-100 xl:hover:text-inherit">
            <div className="xl:hidden">
                <H2>Contents</H2>
            </div>
            <h2 className="mb-4 hidden text-xl text-white xl:block">Contents</h2>
            <div className="xl:text-sm xl:leading-5">
                {headings.map((h) => {
                    return (
                        <p key={h.id} className={(h.level === 3 ? "pl-6" : "") + " my-2"}>
                            <Link href={"#" + h.id} className="hover:text-white hover:underline">
                                <Markdown
                                    inlineCodeLanguage={inlineCodeLanguage}
                                    markdown={h.text}
                                    inline
                                />
                            </Link>
                        </p>
                    );
                })}
            </div>
        </div>
    );
});

const P: Components["p"] = memo(({ children }) => {
    return <p>{children}</p>;
});
const PWithDraft: Components["p"] = memo(({ children }) => {
    const check = (s: unknown) => typeof s === "string" && /TODO:/i.test(s);
    const isTodo = check(children) || (Array.isArray(children) && children.some(check));
    if (isTodo) {
        return (
            <p className="my-4 bg-red-900 py-2 text-xl font-bold text-white outline outline-offset-8 outline-red-600">
                {children}
            </p>
        );
    }

    return <p>{children}</p>;
});

interface MdImageProps {
    src?: string;
    alt?: string;
    getImageUrl?: (url: string) => string;
}
const MdImage = memo(({ src, alt, getImageUrl }: MdImageProps) => {
    return (
        // eslint-disable-next-line @next/next/no-img-element
        <img
            src={getImageUrl && src ? getImageUrl(src) : src}
            alt={alt || "image"}
            className="-mx-4 my-4 max-w-[calc(100%+2rem)] md:mx-0 md:max-w-full"
            loading="lazy"
        />
    );
});

const staticComponents = {
    pre: ForwardChildren,
    code: Code,

    a({ children, href = "#" }) {
        return <TextLink href={href}>{children}</TextLink>;
    },

    ol({ children, start, type }) {
        return (
            <ol
                className="narrow normal-my list-decimal pl-10"
                start={start}
                type={type}
                dir="auto"
            >
                {children}
            </ol>
        );
    },
    ul({ children }) {
        return (
            <ul className="narrow normal-my list-disc pl-10" dir="auto">
                {children}
            </ul>
        );
    },

    h1: H1,
    h2(props) {
        // if (props.children === "Contents") {
        //     return <TOC />;
        // }
        return <H2 {...props} />;
    },
    h3: H3,
    h4: H4,

    strong({ children }) {
        return <strong className="font-bold text-zinc-200">{children}</strong>;
    },

    blockquote({ children, ...props }) {
        const source =
            "data-src" in props && typeof props["data-src"] === "string" ? props["data-src"] : "";
        let sourceLine;
        if (source) {
            let domain;
            try {
                domain = new URL(source).hostname;
            } catch {
                domain = source.replace(/^https?:\/\//, "").replace(/[/?#][\s\S]*/, "");
            }
            sourceLine = (
                <div className="text-right text-sm text-neutral-400">
                    source: <TextLink href={source}>{domain}</TextLink>
                </div>
            );
        }
        return (
            <blockquote className="compact my-4 border-l-4 border-solid border-neutral-500 pl-4 text-zinc-300">
                {children}
                {sourceLine}
            </blockquote>
        );
    },

    table({ children }) {
        return (
            <div className="overflow-x-auto">
                <table className="table-auto">{children}</table>
            </div>
        );
    },
    th({ children, style }) {
        return (
            <th className="border-2 border-zinc-800 p-2 text-white" style={style}>
                {children}
            </th>
        );
    },
    td({ children, style }) {
        return (
            <td className="border-2 border-zinc-800 p-2" style={style}>
                {children}
            </td>
        );
    },
    tbody({ children }) {
        return <tbody className="group">{children}</tbody>;
    },
    tr({ children }) {
        return <tr className="group-[]:odd:bg-zinc-950">{children}</tr>;
    },

    div(props) {
        if (props.className === "info" || props.className === "side-note") {
            const title = props.className === "side-note" ? "Side note" : "Info";
            return (
                <div className="narrow -mx-4 my-4 rounded-md bg-gray-800 py-px pl-8 pr-4 md:mx-0 md:px-6">
                    <div className="-mb-2 mt-4">
                        <strong>{title}:</strong>
                    </div>
                    <div className="compact my-4">{props.children}</div>
                </div>
            );
        }

        return <div {...props} />;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    span({ node: _node, ...props }) {
        if (props.className === "katex-display") {
            return (
                <div className="-mx-4 -my-2 overflow-x-auto px-4 py-px md:-mx-6 md:px-6 lg:mx-0 lg:px-0">
                    <span {...props} />
                </div>
            );
        }

        return <span {...props} />;
    },
} satisfies Partial<Components>;

interface MarkdownProps {
    markdown: string;
    inline?: boolean;
    inlineCodeLanguage?: string;
    draft?: boolean;
    noH1?: boolean;
    getImageUrl?: Record<string, string> | ((url: string) => string);
}

export const Markdown = memo(
    ({ markdown, getImageUrl, noH1, inline, draft, inlineCodeLanguage }: MarkdownProps) => {
        const getImageUrlFn = useMemo(() => {
            if (typeof getImageUrl === "function") {
                return getImageUrl;
            } else if (getImageUrl) {
                return (url: string) => getImageUrl[url] || url;
            } else {
                return undefined;
            }
        }, [getImageUrl]);

        const components: Partial<Components> = {
            ...staticComponents,
            img: (props) => <MdImage {...props} getImageUrl={getImageUrlFn} />,
            h1: noH1 ? Empty : staticComponents.h1,
            p: inline ? ForwardChildren : draft ? PWithDraft : P,
            code: inlineCodeLanguage
                ? (props) => <Code {...props} inlineCodeLang={inlineCodeLanguage} />
                : staticComponents.code,
        };

        return (
            <ReactMarkdown
                components={components as never}
                rehypePlugins={[rehypeRaw, rehypeKatex]}
                remarkPlugins={[remarkGfm, remarkMath]}
            >
                {markdown}
            </ReactMarkdown>
        );
    },
);
