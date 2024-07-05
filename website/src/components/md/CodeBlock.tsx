import { memo } from "react";
import { SyntaxHighlight } from "./SyntaxHighlight";
import { Source_Code_Pro } from "next/font/google";

const sourceCodePro = Source_Code_Pro({ subsets: ["latin"] });

interface CodeBlockProps {
    lang?: string;
    code: string;
}
export const CodeBlock = memo(({ lang, code }: CodeBlockProps) => {
    return (
        <pre
            className={
                sourceCodePro.className +
                " -mx-6 my-4 w-[calc(100%+3rem)] text-[15px] overflow-auto whitespace-pre rounded-md bg-neutral-950 px-6 py-3 text-base leading-5 md:mx-0 md:w-auto md:max-w-full md:px-8"
            }
        >
            <SyntaxHighlight code={code.replace(/\n$/, "")} lang={lang || "none"} />
        </pre>
    );
});
