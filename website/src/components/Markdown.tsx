"use client";

import Link from "next/link";
import React, { memo } from "react";
import ReactMarkdown, { Components } from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkMath from "remark-math";
import { ConversionConstantsSearch } from "./ConversionConstantsSearch";
import "katex/dist/katex.min.css";
import { SyntaxHighlight } from "./SyntaxHighlight";

const knownComponents = {
    "conversion-brute-force": ConversionConstantsSearch,
};
// eslint-disable-next-line react/display-name
const CustomComponent = memo(({ json }: { json: string }) => {
    interface ComponentDesc {
        component: string;
        props?: Record<string, unknown>;
    }
    const value = JSON.parse(json) as ComponentDesc;

    const Component = knownComponents[value.component];

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
                    {" " + code + " "}
                </code>
            );
        } else {
            const lang = /\blanguage-([\w:\-]+)/.exec(className || "")?.[1];
            let inner;
            if (lang === "json:custom") {
                return <CustomComponent json={code} />;
            } else if (lang) {
                inner = <SyntaxHighlight code={code.replace(/\n$/, "")} lang={lang} />;
            } else {
                inner = <code>{children}</code>;
            }
            return (
                <pre className="bg-neutral-950 px-[calc(0.6*4rem)] py-3 mb-6 rounded-md whitespace-pre overflow-auto max-w-full">
                    {inner}
                </pre>
            );
        }
    },
    p({ children }) {
        return <p className="my-6">{children}</p>;
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
};

interface MarkdownProps {
    code: string;
}

// eslint-disable-next-line react/display-name
export const Markdown = memo(({ code }: MarkdownProps) => {
    return (
        <ReactMarkdown
            components={components}
            rehypePlugins={[rehypeRaw, rehypeKatex]}
            remarkPlugins={[remarkMath]}
        >
            {code}
        </ReactMarkdown>
    );
});
