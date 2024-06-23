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
                <code className="bg-black py-0.5 rounded-md whitespace-pre">
                    {" "}
                    <HighlightInlineCode>{code}</HighlightInlineCode>{" "}
                </code>
            );
        } else {
            const lang = /\blanguage-([-\w:]+)/.exec(className || "")?.[1];
            let inner;
            if (lang === "json:custom") {
                return <CustomComponent json={code} />;
            } else if (lang) {
                inner = <SyntaxHighlight code={code.replace(/\n$/, "")} lang={lang} />;
            } else {
                inner = <code>{children}</code>;
            }
            return (
                <pre className="bg-neutral-950 px-[calc(0.6*4rem)] py-3 mb-6 rounded-md whitespace-pre overflow-auto max-w-full text-base">
                    {inner}
                </pre>
            );
        }
    },
    p({ children }) {
        return <p className="my-6 text-justify">{children}</p>;
    },
    a({ children, href }) {
        return (
            <Link href={href ?? "#"} className="border-b pb-[2px] border-dotted hover:border-solid">
                {children}
            </Link>
        );
    },

    ol({ children }) {
        return (
            <ol className="list-decimal my-6 pl-[calc(0.6*4rem)]" dir="auto">
                {children}
            </ol>
        );
    },
    ul({ children }) {
        return (
            <ul className="list-disc my-6 pl-[calc(0.6*4rem)]" dir="auto">
                {children}
            </ul>
        );
    },
    li({ children }) {
        return <li>{children}</li>;
    },

    h1({ children }) {
        return (
            <h1 className="text-5xl font-bold mb-6 text-white">
                {"# "}
                {children}
            </h1>
        );
    },
    h2({ children }) {
        return (
            <h1 className="font-bold mb-6 mt-24 text-white">
                {"## "}
                {children}
            </h1>
        );
    },

    div(props) {
        if (props.className === "info" || props.className === "side-note") {
            const title = props.className === "side-note" ? "Side note" : "Info";
            return (
                <div className="info-box bg-gray-800 px-[calc(0.6*4rem)] pb-6 pt-4 rounded-md my-6">
                    <div className="pb-3">
                        <strong>{title}:</strong>
                    </div>
                    <div className="inner [&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                        {props.children}
                    </div>
                </div>
            );
        }

        return <div {...props} />;
    },
};

const InlineCodeLangContext = createContext<string | undefined>(undefined);

const HighlightInlineCode = memo(({ children }: { children: string }) => {
    const lang = useContext(InlineCodeLangContext);
    if (lang) {
        return <SyntaxHighlight code={children} lang={lang} />;
    } else {
        return <>{children}</>;
    }
});

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
