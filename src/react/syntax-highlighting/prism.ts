import { Prism, Token, type TokenStream } from "./vendor-prism/core";

// Only import components as needed
import "./vendor-prism/c";
import "./vendor-prism/css";
import "./vendor-prism/json";
import "./vendor-prism/nasm";
import "./vendor-prism/python";
import "./vendor-prism/rust";
import "./vendor-prism/yaml";
import "./vendor-prism/markdown";

export function highlight(code: string, lang: string): string {
    lang = resolveAlias(lang);
    return Prism.highlight(
        code,
        (Prism.languages as Record<string, any>)[lang] || Prism.languages.plain,
        lang,
    );
}

const aliases = {
    md: "markdown",
    nasm: "asm",
    py: "python",
    rs: "rust",
    yml: "yaml",
    "c++": "cpp",
    "c#": "cs",
    markup: "html",
    js: "javascript",
    ts: "typescript",
} as const;
export function resolveAlias(lang: string): string {
    lang = lang.toLowerCase().trim();
    return (aliases as Record<string, string>)[lang] || lang;
}

export function getLangTitle(lang: string): string | undefined {
    switch (resolveAlias(lang)) {
        case "asm":
            return "ASM";
        case "c":
            return "C";
        case "cpp":
            return "C++";
        case "cs":
            return "C#";
        case "html":
            return "HTML";
        case "javascript":
            return "JavaScript";
        case "json":
            return "JSON";
        case "java":
            return "Java";
        case "markdown":
            return "Markdown";
        case "python":
            return "Python";
        case "rust":
            return "Rust";
        case "typescript":
            return "TypeScript";
        case "yaml":
            return "YAML";
        default:
            return undefined;
    }
}

// Remove pure punctuation tokens to simplify HTML
Prism.hooks.add("after-tokenize", (env) => {
    function withoutPunctuation(tokens: TokenStream): TokenStream {
        const newTokens: TokenStream = [];

        const addString = (str: string) => {
            if (str.length === 0) return;
            const lastIndex = newTokens.length - 1;
            if (lastIndex >= 0 && typeof newTokens[lastIndex] === "string") {
                newTokens[lastIndex] = (newTokens[lastIndex] as string) + str;
            } else {
                newTokens.push(str);
            }
        };
        const add = (e: Token | string) => {
            if (typeof e === "string") {
                addString(e);
            } else {
                newTokens.push(e);
            }
        };

        for (const token of tokens) {
            if (typeof token !== "string" && token.type === "punctuation") {
                if (typeof token.content === "string") {
                    addString(token.content);
                } else {
                    for (const subToken of withoutPunctuation(token.content)) {
                        add(subToken);
                    }
                }
            } else {
                add(token);
            }
        }

        return newTokens;
    }

    const tokens = env.tokens as TokenStream;
    env.tokens = withoutPunctuation(tokens);
});

export { Prism };
