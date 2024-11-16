import { memo } from "react";
import { SyntaxHighlight } from "./SyntaxHighlight";
import { Source_Code_Pro } from "next/font/google";
import Link from "next/link";

const sourceCodePro = Source_Code_Pro({ subsets: ["latin"] });

function indent(s: string, indent: string = "    ") {
    return s.replace(/^(?!$)/gm, indent);
}
function getRustPlaygroundLink(code: string) {
    if (!/\bfn\s+main\s*\(/.test(code)) {
        code = `fn main() {\n${indent(code.trim())}\n}\n`;
    }

    const link = new URL("https://play.rust-lang.org/?version=stable&edition=2021");
    link.searchParams.set("code", code);

    return link.href;
}

function getLangTitle(lang: string): string | undefined {
    switch (lang.toLowerCase().trim()) {
        case "asm":
            return "ASM";
        case "c":
            return "C";
        case "cpp":
            return "C++";
        case "cs":
            return "C#";
        case "rs":
        case "rust":
            return "Rust";
        case "py":
            return "Python";
        case "js":
        case "javascript":
            return "JavaScript";
        case "java":
            return "Java";
        case "ts":
        case "typescript":
            return "TypeScript";
        default:
            return undefined;
    }
}

interface CodeBlockProps {
    code: string;
    lang?: string;
    runnable?: boolean;
}
export const CodeBlock = memo(({ code, lang, runnable }: CodeBlockProps) => {
    runnable ??= /\bassert(?:_eq|_ne)?!/.test(code);

    const langTitle = getLangTitle(lang || "");

    let title;
    if (runnable) {
        title = (
            <div className="relative">
                <div className="absolute -top-1 right-3">
                    <Link
                        href={getRustPlaygroundLink(code)}
                        className="run-link rounded-md px-6 py-2 leading-4 hover:bg-blue-800 hover:text-white focus:bg-blue-800 focus:text-white"
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Run on Rust Playground"
                    >
                        Run
                    </Link>
                </div>
            </div>
        );
    } else if (langTitle) {
        title = (
            <div className="relative">
                <div className={sourceCodePro.className + " absolute right-0 top-0 text-[13px]"}>
                    <span className="mr-1.5 select-none text-slate-400">{langTitle}</span>
                </div>
            </div>
        );
    }

    return (
        <div className="-mx-4 my-2 w-[calc(100%+2rem)] md:-mx-6 md:w-[calc(100%+3rem)] lg:mx-0 lg:w-auto lg:max-w-full">
            {title}
            <pre
                tabIndex={0}
                className={
                    sourceCodePro.className +
                    " text-[13px] sm:text-[14px] overflow-auto whitespace-pre rounded-md bg-black px-4 py-4 leading-5 md:px-6 lg:px-8 print:text-[13px]"
                }
            >
                <SyntaxHighlight code={code.replace(/\n$/, "")} lang={lang || "none"} />
            </pre>
        </div>
    );
});
