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
import { CustomComponent } from "./CustomComponents";
import { Components, getAllHeadings, getHeadingId, getTextContent } from "../../lib/md-util";
import "katex/dist/katex.min.css";
import { TextLink } from "./TextLink";
import { InlineColor } from "./InlineColor";

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
        const before = <InlineColor code={children} />;
        if (lang) {
            return (
                <code className={className}>
                    {before}
                    <SyntaxHighlight code={children} noCodeElement lang={lang} />
                </code>
            );
        } else {
            return (
                <code className={className}>
                    {before}
                    {children}
                </code>
            );
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
            <div className="md:hidden">
                <H2>Contents</H2>
            </div>
            <h2 className="mb-4 hidden text-xl text-white md:block">Contents</h2>
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
        const short = code.length < 20;
        return (
            <HighlightInlineCode
                className={
                    (short ? "whitespace-pre" : "md:whitespace-pre") +
                    " rounded-md bg-black px-2 py-0.5 text-[90%]"
                }
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

    return <p>{children}</p>;
});

const H1: Components["h1"] = memo(({ children }) => {
    const { afterHeader } = useContext(MdContext);

    return (
        <>
            <h1 className="mb-4 text-3xl font-bold leading-10 text-white md:mb-8 md:text-4xl md:leading-[3rem]">
                {children}
            </h1>
            {afterHeader}
        </>
    );
});
const H2: Components["h2"] = memo(({ children, node }) => {
    const id = getHeadingId(getTextContent(children, node));
    return (
        <h2
            id={id}
            className="mb-8 mt-4 border-b-2 border-b-neutral-500 pt-8 text-2xl text-white md:text-3xl"
        >
            <Link
                href={"#" + id}
                className="relative before:absolute before:-left-8 before:opacity-25 hover:before:opacity-75 md:before:content-['#']"
            >
                {children}
            </Link>
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
        return <TextLink href={href}>{children}</TextLink>;
    },

    ol({ children, start, type }) {
        return (
            <ol className="normal-my list-decimal pl-10" start={start} type={type} dir="auto">
                {children}
            </ol>
        );
    },
    ul({ children }) {
        return (
            <ul className="normal-my list-disc pl-10" dir="auto">
                {children}
            </ul>
        );
    },
    li({ children }) {
        return <li className="my-2">{children}</li>;
    },

    h1: H1,
    h2(props) {
        if (props.children === "Contents") {
            return <TOC />;
        }
        return <H2 {...props} />;
    },
    h3({ children, node }) {
        const id = getHeadingId(getTextContent(children, node));
        return (
            <h3
                id={id}
                className="mb-4 mt-8 border-b-2 border-dashed border-b-neutral-500 text-xl text-white md:text-2xl"
            >
                <Link
                    href={"#" + id}
                    className="relative before:absolute before:-left-7 before:opacity-25 hover:before:opacity-75 md:before:content-['#']"
                >
                    {children}
                </Link>
            </h3>
        );
    },
    h4({ children, node }) {
        const id = getHeadingId(getTextContent(children, node));
        return (
            <h4
                id={id}
                className="mb-4 mt-6 border-b-2 border-dotted border-b-neutral-700 text-lg text-white md:text-xl"
            >
                <Link
                    href={"#" + id}
                    className="relative before:absolute before:-left-6 before:opacity-25 hover:before:opacity-75 md:before:content-['#']"
                >
                    {children}
                </Link>
            </h4>
        );
    },

    strong({ children }) {
        return <strong className="font-bold text-zinc-200">{children}</strong>;
    },

    blockquote({ children }) {
        return (
            <blockquote className="compact my-4 border-l-4 border-solid border-neutral-500 pl-4 text-zinc-400">
                {children}
            </blockquote>
        );
    },

    div(props) {
        if (props.className === "info" || props.className === "side-note") {
            const title = props.className === "side-note" ? "Side note" : "Info";
            return (
                <div className="-mx-6 my-3 rounded-md bg-gray-800 py-px pl-10 pr-6 md:mx-0 md:px-8">
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
