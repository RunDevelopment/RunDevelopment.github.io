"use client";

import Link from "next/link";
import React, { ReactNode, createContext, memo, useContext, useEffect, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { SyntaxHighlight } from "./SyntaxHighlight";
import { CodeBlock } from "./CodeBlock";
import { FaExternalLinkAlt } from "react-icons/fa";
import { CustomComponent } from "./CustomComponents";
import { Components, getAllHeadings, getHeadingId, getTextContent } from "../../lib/md-util";
import "katex/dist/katex.min.css";

interface MdContextProps {
    markdown: string;
    inline?: boolean;
    inlineCodeLanguage?: string;
    draft?: boolean;
    afterHeader?: ReactNode;
}
const MdContext = createContext<MdContextProps>({ markdown: "" });

const HighlightInlineCode = memo(
    ({ children, className }: { children: string; className?: string }) => {
        const { inlineCodeLanguage: lang } = useContext(MdContext);
        if (lang) {
            return (
                <code className={className}>
                    <SyntaxHighlight code={children} noCodeElement lang={lang} />
                </code>
            );
        } else {
            return <code className={className}>{children}</code>;
        }
    },
);

const TOC = memo(() => {
    const { markdown, ...rest } = useContext(MdContext);

    const headings = useMemo(
        () =>
            getAllHeadings(markdown).filter(
                (h) => h.level >= 2 && h.level <= 3 && h.text !== "Contents",
            ),
        [markdown],
    );

    useEffect(() => {
        let lastValue = 0;
        const threshold = 400;

        const listener = () => {
            if (lastValue > threshold && window.scrollY > threshold) {
                // do nothing
                return;
            }
            lastValue = window.scrollY;

            // set CSS variable
            document.documentElement.style.setProperty(
                "--scroll-y",
                window.scrollY.toString() + "px",
            );
        };

        if (window.onscrollend) {
            window.addEventListener("scrollend", listener);
            return () => {
                window.removeEventListener("scrollend", listener);
            };
        } else {
            window.addEventListener("scroll", listener);
            return () => {
                window.removeEventListener("scroll", listener);
            };
        }
    }, []);

    return (
        <div className="hover:opacity-100 md:fixed md:bottom-0 md:left-0 md:max-h-[calc(100vh-max(0px,200px-var(--scroll-y)))] md:max-w-[calc(max(200px,50vw-320px))] md:overflow-y-auto md:p-6 md:opacity-50 md:focus-within:opacity-100 md:hover:text-inherit">
            <h2 className="mb-12 mt-8 border-b-2 border-b-neutral-500 pt-8 text-3xl text-white md:mb-8 md:mt-0 md:pt-0">
                Contents
            </h2>
            <div className="md:text-sm md:leading-5">
                {headings.map((h) => {
                    return (
                        <p key={h.id} className={(h.level === 3 ? "pl-6" : "") + " my-2"}>
                            <Link href={"#" + h.id} className="hover:text-white hover:underline">
                                <Markdown {...rest} code={h.text} inline />
                            </Link>
                        </p>
                    );
                })}
            </div>
        </div>
    );
});

const Code: Components["code"] = memo(({ children, className }) => {
    const code = String(children);
    const inline = !code.includes("\n");

    if (inline) {
        return (
            <HighlightInlineCode className="rounded-md bg-black px-2 py-0.5 md:whitespace-pre">
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
const P: Components["p"] = memo(({ children }) => {
    const { draft, inline } = useContext(MdContext);

    if (inline) {
        return <>{children}</>;
    }

    if (draft) {
        const check = (s: unknown) => typeof s === "string" && /TODO:/i.test(s);
        const isTodo = check(children) || (Array.isArray(children) && children.some(check));
        if (isTodo) {
            return (
                <p className="my-4 bg-red-900 py-2 text-xl font-bold text-white outline outline-offset-8 outline-red-600">
                    {children}
                </p>
            );
        }
    }

    return <p className="my-4">{children}</p>;
});

const H1: Components["h1"] = memo(({ children }) => {
    const { afterHeader } = useContext(MdContext);

    return (
        <>
            <h1 className="mb-8 text-4xl font-bold text-white md:text-5xl md:leading-[3.5rem]">
                {children}
            </h1>
            {afterHeader}
        </>
    );
});
const H2: Components["h2"] = memo(({ children, node }) => {
    if (children === "Contents") {
        return <TOC />;
    }

    const id = getHeadingId(getTextContent(children, node));
    return (
        <h2 id={id} className="mb-12 mt-8 border-b-2 border-b-neutral-500 pt-8 text-3xl text-white">
            <Link href={"#" + id}>{children}</Link>
        </h2>
    );
});

const components: Partial<Components> = {
    pre({ children }) {
        return <>{children}</>;
    },
    code: Code,
    p: P,
    a({ children, href = "#" }) {
        const external = href.startsWith("http");
        return (
            <Link
                href={href}
                className="border-b border-dotted pb-[2px] hover:border-solid hover:text-white"
            >
                {children}
                {external && <FaExternalLinkAlt className="ml-1 inline-block w-3 align-baseline" />}
            </Link>
        );
    },

    ol({ children, start, type }) {
        return (
            <ol className="my-4 list-decimal pl-10" start={start} type={type} dir="auto">
                {children}
            </ol>
        );
    },
    ul({ children }) {
        return (
            <ul className="my-4 list-disc pl-10" dir="auto">
                {children}
            </ul>
        );
    },
    li({ children }) {
        return <li className="my-1">{children}</li>;
    },

    h1: H1,
    h2: H2,
    h3({ children, node }) {
        const id = getHeadingId(getTextContent(children, node));
        return (
            <h3
                id={id}
                className="mb-6 mt-12 border-b-2 border-dashed border-b-neutral-500 text-2xl text-white"
            >
                <Link href={"#" + id}>{children}</Link>
            </h3>
        );
    },
    h4({ children, node }) {
        const id = getHeadingId(getTextContent(children, node));
        return (
            <h4
                id={id}
                className="mb-4 mt-8 border-b-2 border-dotted border-b-neutral-700 text-xl text-white"
            >
                <Link href={"#" + id}>{children}</Link>
            </h4>
        );
    },

    div(props) {
        if (props.className === "info" || props.className === "side-note") {
            const title = props.className === "side-note" ? "Side note" : "Info";
            return (
                <div className="info-box my-6 rounded-md bg-gray-800 px-8 pb-6 pt-4">
                    <div className="pb-3">
                        <strong>{title}:</strong>
                    </div>
                    {/* eslint-disable-next-line tailwindcss/no-custom-classname */}
                    <div className="inner [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {props.children}
                    </div>
                </div>
            );
        }

        return <div {...props} />;
    },
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    span({ node, ...props }) {
        if (props.className === "katex-display") {
            return (
                <div className="-mx-6 -my-2 overflow-x-auto px-6 py-px md:mx-0 md:px-0">
                    <span {...props} />
                </div>
            );
        }

        return <span {...props} />;
    },
};

interface MarkdownProps {
    code: string;
    inline?: boolean;
    inlineCodeLanguage?: string;
    draft?: boolean;
    afterHeader?: ReactNode;
}

export const Markdown = memo(
    ({ code, inline, inlineCodeLanguage, draft, afterHeader }: MarkdownProps) => {
        return (
            <MdContext.Provider
                value={{ markdown: code, inline, inlineCodeLanguage, draft, afterHeader }}
            >
                <ReactMarkdown
                    components={components as never}
                    rehypePlugins={[rehypeRaw, rehypeKatex]}
                    remarkPlugins={[remarkGfm, remarkMath]}
                >
                    {code}
                </ReactMarkdown>
            </MdContext.Provider>
        );
    },
);
