"use client";

import React, { memo, useState, useEffect } from "react";
import { PrismLight as SyntaxHighlighter } from "react-syntax-highlighter";
import rust from "react-syntax-highlighter/dist/esm/languages/prism/rust";
import c from "react-syntax-highlighter/dist/esm/languages/prism/c";
import json from "react-syntax-highlighter/dist/esm/languages/prism/json";
import yaml from "react-syntax-highlighter/dist/esm/languages/prism/yaml";
import python from "react-syntax-highlighter/dist/esm/languages/prism/python";
import markdown from "react-syntax-highlighter/dist/esm/languages/prism/markdown";
import { coldarkDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { ForwardChildren } from "../util";

SyntaxHighlighter.registerLanguage("rust", rust);
SyntaxHighlighter.registerLanguage("c", c);
SyntaxHighlighter.registerLanguage("json", json);
SyntaxHighlighter.registerLanguage("yaml", yaml);
SyntaxHighlighter.registerLanguage("python", python);
SyntaxHighlighter.registerLanguage("markdown", markdown);

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function nasm(Prism: any) {
    Prism.languages.nasm = Prism.languages.asm = {
        comment: {
            pattern: /;.*/g,
            greedy: true,
        },
        string: {
            pattern: /"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'/g,
            greedy: true,
        },
        keyword: [
            /\[?BITS (?:16|32|64)\]?/,
            {
                pattern: /(^\s*)section\s*[a-z.]+:?/im,
                lookbehind: true,
            },
            /(?:extern|global)[^;\r\n]*/i,
            /(?:CPU|DEFAULT|FLOAT).*$/m,
        ],
        instruction: {
            pattern: /^[ \t]*\.?\w+(?=\s|$)/m,
            greedy: true,
            alias: "keyword",
        },
        label: {
            pattern: /^[ \t]*\.?\w+(?=:(?!:))|\.[A-Z]\w*\b|(-|\.(?:rodata|text)\.)[a-z]\w*/m,
            lookbehind: true,
            alias: "function",
        },
        register: {
            pattern:
                /%?\b(?:st\d|[xyz]mm\d\d?|[cdt]r\d|r\d\d?[bwd]?|[er]?[abcd]x|[abcd][hl]|[er]?(?:bp|di|si|sp)|[cdefgs]s)\b/,
            alias: "variable",
        },
        number: /\b\d+\b|\b0x[\da-f]+\b/i,
        punctuation: /[[\]:,+]/,
    };
}
nasm.displayName = "nasm";
SyntaxHighlighter.registerLanguage("nasm", nasm);

SyntaxHighlighter.alias({
    rust: "rs",
    python: "py",
    yaml: "yml",
    markdown: "md",
    nasm: "asm",
});

interface SyntaxHighlightProps {
    code: string;
    lang: string;
    noCodeElement?: boolean;
}

export const SyntaxHighlight = memo(({ code, lang, noCodeElement }: SyntaxHighlightProps) => {
    const [dark, setDark] = useState(true);

    useEffect(() => {
        const makeDark = () => setDark(true);
        const makeLight = () => setDark(false);

        window.addEventListener("beforeprint", makeLight);
        window.addEventListener("afterprint", makeDark);

        return () => {
            window.removeEventListener("beforeprint", makeLight);
            window.removeEventListener("afterprint", makeDark);
        };
    }, []);

    return (
        <SyntaxHighlighter
            PreTag={ForwardChildren}
            CodeTag={noCodeElement ? ForwardChildren : undefined}
            // eslint-disable-next-line react/no-children-prop
            children={code}
            language={lang}
            style={dark ? coldarkDark : oneLight}
        />
    );
});
