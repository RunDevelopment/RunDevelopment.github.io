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
import { ImageSize } from "../../lib/schema";
import { TodoMarker } from "./TodoMarker";
import { InfoBox } from "./InfoBox";

/** Returns a map from line number to code block meta. */
function parseCodeMeta(markdown: string): Map<number, string> {
    const lines = markdown.split("\n");
    const map = new Map<number, string>();
    const pattern = /^[ \t]*``` *\S+ +(\S.*)/;
    for (let i = 0; i < lines.length; i++) {
        const match = pattern.exec(lines[i]);
        if (match) {
            map.set(i + 1, match[1].trim());
        }
    }
    return map;
}

interface CodeProps {
    children?: ReactNode;
    className?: string;
    inlineCodeLang?: string | undefined;
    meta?: string | undefined;
}
const Code = memo(({ children, className, inlineCodeLang, meta }: CodeProps) => {
    const code = String(children);
    const inline = !code.includes("\n");

    if (inline) {
        return <InlineCode lang={inlineCodeLang} code={code} smaller />;
    } else {
        const lang = /\blanguage-([-\w:]+)/.exec(className || "")?.[1];
        if (lang === "json:custom") {
            return <CustomComponent json={code} />;
        } else if ((lang === "md" || lang === "markdown") && meta === "@render") {
            return (
                <>
                    <CodeBlock lang="markdown" code={code} />
                    <Markdown markdown={code} />
                </>
            );
        } else {
            return <CodeBlock lang={lang} code={code} meta={meta} />;
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
            <h2 className="mb-2 mt-12 font-header text-xl text-white" id="contents">
                Contents
            </h2>
            <ul dir="auto">
                {headings.map((h, i) => {
                    return (
                        <li key={h.id + "-" + i} className={h.level === 3 ? "pl-6" : "pt-1"}>
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
    src?: string | Blob;
    alt?: string;
    getImageUrl: (url: string) => string | undefined;
    getImageSize: (url: string) => ImageSize | undefined;
}
const MdImage = memo(({ src, alt = "Image", getImageUrl, getImageSize }: MdImageProps) => {
    const size = typeof src === "string" ? getImageSize(src) : undefined;

    const styles: string[] = [];
    const extract = (pattern: RegExp, fn: (match: RegExpExecArray) => string) => {
        const match = pattern.exec(alt);
        if (match) {
            styles.push(fn(match));
            alt = alt.replace(pattern, "").trim();
        }
    };
    extract(/@narrow$/, () => "max-width:calc(min(100%,var(--page-narrow-width)))");
    extract(/@max-width:(.+)$/, ([, maxWidth]) => `max-width:calc(min(100%,${maxWidth}))`);

    let id = undefined;
    let css = styles.join(";");
    if (css) {
        id = btoa(src + ";\n" + css).replace(/\W/g, "-");
        css = `#${id}{${css}}`;
    }

    let finalSrc;
    if (typeof src === "string") {
        finalSrc = getImageUrl(src);
    } else if (src) {
        finalSrc = URL.createObjectURL(src);
    }

    return (
        <div className="-mx-4 my-4 w-[calc(100%+2rem)] text-center md:-mx-6 md:w-[calc(100%+3rem)] lg:mx-0 lg:w-auto lg:max-w-full">
            {css && <style dangerouslySetInnerHTML={{ __html: css }} />}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
                id={id}
                src={finalSrc}
                alt={alt}
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
    h2: H2,
    h3: H3,
    h4: H4,

    em({ children }) {
        return <em className="italic text-white">{children}</em>;
    },
    strong({ children }) {
        return <strong className="font-bold text-white">{children}</strong>;
    },
    del({ children }) {
        return <del className="text-neutral-500">{children}</del>;
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
            <div className="justify-items-center">
                <table className="table-auto">{children}</table>
            </div>
        );
    },
    th({ children, style }) {
        return (
            <th className="border-2 border-zinc-700 p-2 text-white" style={style}>
                {children}
            </th>
        );
    },
    td({ children, style }) {
        return (
            <td className="border-2 border-zinc-700 px-2 py-1" style={style}>
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
            const titleKey = "data-title";
            const customTitle =
                titleKey in props && typeof props[titleKey] === "string"
                    ? props[titleKey]
                    : undefined;
            const title = customTitle ? <Markdown inline markdown={customTitle} /> : "Info";
            return <InfoBox title={title}>{props.children}</InfoBox>;
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
    getImageUrl?: Record<string, string> | ((url: string) => string);
    imageSizes?: Record<string, ImageSize>;
}

export const Markdown = memo(
    ({ markdown, getImageUrl, imageSizes, inline, draft, inlineCodeLanguage }: MarkdownProps) => {
        const getImageUrlFn =
            typeof getImageUrl === "function"
                ? getImageUrl
                : (url: string) => getImageUrl?.[url] || url;
        const codeMeta = useMemo(() => parseCodeMeta(markdown), [markdown]);

        const components: Partial<Components> = {
            ...staticComponents,
            img: (props) => (
                <MdImage
                    {...props}
                    getImageUrl={getImageUrlFn}
                    getImageSize={(url) => imageSizes?.[url]}
                />
            ),
            h2: (props) =>
                props.children === "Contents" ? <TOC markdown={markdown} /> : <H2 {...props} />,
            p: inline ? ForwardChildren : draft ? PWithDraft : P,
            code: (props) => {
                const line = props.node?.position?.start.line;
                const meta = line ? codeMeta.get(line) : undefined;
                return <Code {...props} inlineCodeLang={inlineCodeLanguage} meta={meta} />;
            },
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
