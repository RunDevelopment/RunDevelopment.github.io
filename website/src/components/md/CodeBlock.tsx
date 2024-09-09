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

interface CodeBlockProps {
    lang?: string;
    code: string;
    runnable?: boolean;
}
export const CodeBlock = memo(({ lang, code, runnable }: CodeBlockProps) => {
    runnable ??= /\bassert(?:_eq|_ne)?!/.test(code);

    let title;
    if (runnable) {
        title = (
            <div className="relative">
                <Link
                    href={getRustPlaygroundLink(code)}
                    className="run-link absolute -top-2 right-3 rounded-md px-6 py-2 leading-4 hover:bg-blue-800 hover:text-white focus:bg-blue-800 focus:text-white"
                    target="_blank"
                    rel="noopener noreferrer"
                    title="Run on Rust Playground"
                >
                    Run
                </Link>
            </div>
        );
    }

    return (
        <div className="-mx-4 my-2 w-[calc(100%+2rem)] md:-mx-6 md:w-[calc(100%+3rem)] lg:mx-0 lg:w-auto lg:max-w-full">
            {title}
            <pre
                className={
                    sourceCodePro.className +
                    " text-[15px] overflow-auto whitespace-pre rounded-md bg-black px-4 py-3 leading-5 md:px-6 lg:px-8 print:text-[13px]"
                }
            >
                <SyntaxHighlight code={code.replace(/\n$/, "")} lang={lang || "none"} />
            </pre>
        </div>
    );
});
