import React, { memo, ReactNode, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { CodeBlock } from "./CodeBlock";
import { CustomComponent } from "./CustomComponents";
import { Components, getAllHeadings } from "../../lib/md-util";
import "katex/dist/katex.min.css";
import { TextLink } from "./TextLink";
import { Empty, ForwardChildren } from "../util";
import { H1, H2, H3, H4 } from "./Headings";
import { InlineCode } from "./InlineCode";
import { identity } from "../../lib/util";
import { ImageSize } from "../../lib/schema";
import { TodoMarker } from "./TodoMarker";

interface CodeProps {
    children?: ReactNode;
    className?: string;
    inlineCodeLang?: string | undefined;
}
const Code = memo(({ children, className, inlineCodeLang }: CodeProps) => {
    const code = String(children);
    const inline = !code.includes("\n");

    if (inline) {
        return <InlineCode lang={inlineCodeLang} code={code} smaller />;
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
}
const TOC = memo(({ markdown }: TOCProps) => {
    const headings = getAllHeadings(markdown).filter(
        (h) => h.level >= 2 && h.level <= 3 && h.text !== "Contents",
    );

    return (
        <section className="narrow">
            <h2 className="mb-2 mt-12 text-xl text-white" id="contents">
                Contents
            </h2>
            <ul dir="auto">
                {headings.map((h) => {
                    return (
                        <li key={h.id} className={h.level === 3 ? "pl-6" : "pt-1"}>
                            <TextLink href={"#" + h.id} simple>
                                <Markdown markdown={h.text} inline />
                            </TextLink>
                        </li>
                    );
                })}
            </ul>
        </section>
    );
});

const P: Components["p"] = memo(({ node, children }) => {
    let containsImage = false;
    if (node && node.children.length === 1) {
        const child = node.children[0];
        containsImage = child.type === "element" && child.tagName === "img";
    }

    if (containsImage) {
        return <>{children}</>;
    }

    return <p>{children}</p>;
});
const PWithDraft: Components["p"] = memo(({ node, children }) => {
    const check = (s: unknown) => typeof s === "string" && /TODO:/i.test(s);
    const isTodo = check(children) || (Array.isArray(children) && children.some(check));
    if (isTodo) {
        return (
            <p className="my-4 bg-red-900 py-2 text-xl font-bold text-white outline outline-offset-8 outline-red-600">
                <TodoMarker />
                {children}
            </p>
        );
    }

    return <P node={node}>{children}</P>;
});

interface MdImageProps {
    src?: string;
    alt?: string;
    getImageUrl: (url: string) => string | undefined;
    getImageSize: (url: string) => ImageSize | undefined;
}
const MdImage = memo(({ src, alt, getImageUrl, getImageSize }: MdImageProps) => {
    const size = src ? getImageSize(src) : undefined;
    return (
        <div className="-mx-4 my-4 w-[calc(100%+2rem)] text-center md:-mx-6 md:w-[calc(100%+3rem)] lg:mx-0 lg:w-auto lg:max-w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                src={src && getImageUrl(src)}
                alt={alt || "image"}
                width={size?.width}
                height={size?.height}
                className="inline-block h-auto max-w-full lg:rounded-md"
                loading="lazy"
            />
        </div>
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
                <div className="narrow normal-my -mx-4 bg-gray-800 py-px pl-8 pr-4 leading-snug md:mx-0 md:px-6">
                    <div className="-mb-2 mt-3">
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
    imageSizes?: Record<string, ImageSize>;
}

export const Markdown = memo(
    ({
        markdown,
        getImageUrl,
        imageSizes,
        noH1,
        inline,
        draft,
        inlineCodeLanguage,
    }: MarkdownProps) => {
        const getImageUrlFn = useMemo(() => {
            if (typeof getImageUrl === "function") {
                return getImageUrl;
            } else if (getImageUrl) {
                return (url: string) => getImageUrl[url] || url;
            } else {
                return identity;
            }
        }, [getImageUrl]);
        const getImageSize = useMemo(() => {
            if (imageSizes) {
                return (url: string) => imageSizes[url];
            } else {
                return () => undefined;
            }
        }, [imageSizes]);

        const components: Partial<Components> = {
            ...staticComponents,
            img: (props) => (
                <MdImage {...props} getImageUrl={getImageUrlFn} getImageSize={getImageSize} />
            ),
            h1: noH1 ? Empty : staticComponents.h1,
            h2: (props) =>
                props.children === "Contents" ? (
                    <TOC markdown={markdown} />
                ) : (
                    staticComponents.h2(props)
                ),
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
