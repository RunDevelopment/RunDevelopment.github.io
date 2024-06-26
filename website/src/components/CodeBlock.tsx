import { memo } from "react";
import { SyntaxHighlight } from "./SyntaxHighlight";

interface CodeBlockProps {
    lang?: string;
    code: string;
}
export const CodeBlock = memo(({ lang, code }: CodeBlockProps) => {
    let inner;
    if (lang) {
        inner = <SyntaxHighlight code={code.replace(/\n$/, "")} lang={lang} />;
    } else {
        inner = <code>{code}</code>;
    }
    return (
        <pre className="-mx-6 my-4 w-[calc(100%+3rem)] overflow-auto whitespace-pre rounded-md bg-neutral-950 px-6 py-3 text-base md:mx-0 md:w-auto md:max-w-full md:px-8">
            {inner}
        </pre>
    );
});
