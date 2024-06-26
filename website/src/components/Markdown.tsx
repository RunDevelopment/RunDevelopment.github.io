"use client";

import Link from "next/link";
import React, { createContext, memo, useContext } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { ConversionConstantsSearch } from "./ConversionConstantsSearch";
import "katex/dist/katex.min.css";
import { SyntaxHighlight } from "./SyntaxHighlight";
import { CodeBlock } from "./CodeBlock";

function getHeadingId(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

const knownComponents = {
    "conversion-brute-force": ConversionConstantsSearch,
};
const CustomComponent = memo(({ json }: { json: string }) => {
    interface ComponentDesc {
        component: string;
        props?: Record<string, unknown>;
    }
    const value = JSON.parse(json) as ComponentDesc;

    const Component = knownComponents[value.component as keyof typeof knownComponents];

    return <Component {...(value.props ?? {})} />;
});

const components: Partial<Components> = {
    pre({ children }) {
        return <>{children}</>;
    },
    code({ children, className }) {
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
    },
    p({ children }) {
        return <p className="my-4">{children}</p>;
    },
    a({ children, href }) {
        return (
            <Link href={href ?? "#"} className="border-b border-dotted pb-[2px] hover:border-solid">
                {children}
            </Link>
        );
    },

    ol({ children }) {
        return (
            <ol className="my-4 list-decimal pl-10" dir="auto">
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

    h1({ children }) {
        return (
            <h1 className="mb-8 text-4xl font-bold text-white md:text-5xl md:leading-[3.5rem]">
                {children}
            </h1>
        );
    },
    h2({ children }) {
        const id = getHeadingId(String(children));
        return (
            <h2
                id={id}
                className="mb-12 mt-8 border-b-2 border-b-neutral-500 pt-8 text-3xl text-white"
            >
                <Link href={"#" + id}>{children}</Link>
            </h2>
        );
    },
    h3({ children }) {
        const id = getHeadingId(String(children));
        return (
            <Link href={"#" + id} id={id}>
                <h3 className="mb-6 mt-12 border-b-2 border-dashed border-b-neutral-500 text-2xl text-white">
                    {children}
                </h3>
            </Link>
        );
    },
    h4({ children }) {
        const id = getHeadingId(String(children));
        return (
            <Link href={"#" + id} id={id}>
                <h4 className="mb-4 mt-8 border-b-2 border-dotted border-b-neutral-700 text-xl text-white">
                    {children}
                </h4>
            </Link>
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

const InlineCodeLangContext = createContext<string | undefined>(undefined);

const HighlightInlineCode = memo(
    ({ children, className }: { children: string; className?: string }) => {
        const lang = useContext(InlineCodeLangContext);
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

interface MarkdownProps {
    code: string;
    inlineCodeLanguage?: string;
}

export const Markdown = memo(({ code, inlineCodeLanguage }: MarkdownProps) => {
    let element = (
        <ReactMarkdown
            components={components}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            remarkPlugins={[remarkGfm, remarkMath]}
        >
            {code}
        </ReactMarkdown>
    );

    if (inlineCodeLanguage) {
        element = (
            <InlineCodeLangContext.Provider value={inlineCodeLanguage}>
                {element}
            </InlineCodeLangContext.Provider>
        );
    }

    return element;
});
