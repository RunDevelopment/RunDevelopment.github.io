import { useContext, createContext } from "react";
import ReactMarkdown from "react-markdown";
import rehypeKatex from "rehype-katex";
import rehypeRaw from "rehype-raw";
import remarkToc from "remark-toc";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import remarkMath from "remark-math";
import rehypeCodeMeta from "rehype-code-meta";
import { type Components, nodeTextContent, parseMetaString } from "./md-util";
import { TextLink } from "../TextLink";
import { ForwardChildren } from "../util";
import { Info } from "./Info";
import { Image } from "./Image";
import { CodeBlock } from "../syntax-highlighting/CodeBlock";
import { InlineCode } from "../syntax-highlighting/InlineCode";
import { getDomain } from "../../lib/util";
import type { ImageInfo } from "../../lib/blog/images";
import "katex/dist/katex.min.css";
import "../../styles/markdown.css";

const MarkdownContext = createContext<{
    inline: boolean;
    inlineCodeLanguage: string;
    componentInsertFunction?: string;
    getImage?: (url: string) => Promise<ImageInfo>;
}>({ inline: false, inlineCodeLanguage: "plain" });

const staticComponents = {
    a({ children, href = "#" }) {
        return <TextLink href={href}>{children}</TextLink>;
    },

    pre: ForwardChildren,
    code({ children, className, node }) {
        if (!className) {
            // className might be in properties as an array of strings
            const classNames = node?.properties?.["className"];
            if (Array.isArray(classNames)) {
                className = classNames.join(" ");
            }
        }

        const context = useContext(MarkdownContext);

        const code = String(children);
        const inline = !code.includes("\n");
        const lang = /(?:\s|^)language-(\S+)/.exec(className || "")?.[1];

        if (inline) {
            return <InlineCode code={code} lang={lang ?? context.inlineCodeLanguage} />;
        }

        if (lang === "json:component" && context.componentInsertFunction) {
            return (
                <>
                    <script>{`${context.componentInsertFunction}(document.currentScript);`}</script>
                    <noscript className="NoScriptMessage">
                        Unable to load interactive Element.
                        <br />
                        Please enable JavaScript.
                    </noscript>
                </>
            );
        }

        const metaString = (node?.properties?.["metastring"] as string | undefined) ?? "";
        const meta = parseMetaString(metaString);

        let after;
        let noLangTitle = false;
        let links: { text: string; title: string; href: string }[] | undefined;

        if (meta.render) {
            after = (
                <>
                    <p>Output:</p>
                    <MarkdownRenderer markdown={code} />
                </>
            );
        }

        if (meta.run) {
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

            links = [
                {
                    text: "Run",
                    title: "Run on Rust Playground",
                    href: getRustPlaygroundLink(code),
                },
            ];
            noLangTitle = true;
        }

        return (
            <>
                <CodeBlock
                    code={code}
                    lang={lang ?? "plain"}
                    langTitle={noLangTitle ? false : undefined}
                    wide={(meta["wide"] as boolean | undefined) ?? "auto"}
                    links={links}
                />
                {after}
            </>
        );
    },

    h1({ children }) {
        // intentionally discard other props
        return <h1>{children}</h1>;
    },
    h2({ children, id }) {
        return (
            <h2 id={id}>
                <a href={`#${id}`}>{children}</a>
            </h2>
        );
    },
    h3({ children, id }) {
        return (
            <h3 id={id}>
                <a href={`#${id}`}>{children}</a>
            </h3>
        );
    },
    h4({ children, id }) {
        return (
            <h4 id={id}>
                <a href={`#${id}`}>{children}</a>
            </h4>
        );
    },
    h5({ children, id }) {
        return (
            <h5 id={id}>
                <a href={`#${id}`}>{children}</a>
            </h5>
        );
    },
    h6({ children, id }) {
        return (
            <h6 id={id}>
                <a href={`#${id}`}>{children}</a>
            </h6>
        );
    },

    table({ children }) {
        return (
            <div className="TableWrapper" data-wide>
                <table>{children}</table>
            </div>
        );
    },

    details({ children }) {
        return (
            <details className="WideDetails" data-wide data-narrow-container>
                {children}
            </details>
        );
    },

    blockquote({ children, ...props }) {
        const source =
            "data-src" in props && typeof props["data-src"] === "string" ? props["data-src"] : "";

        return (
            <blockquote>
                {children}
                {source && (
                    <div className="SourceLine">
                        source:{" "}
                        <a href={source} target="_blank" rel="noopener noreferrer">
                            {getDomain(source)}
                        </a>
                    </div>
                )}
            </blockquote>
        );
    },

    div(props) {
        if (props.className === "info" || props.className === "side-note") {
            const titleKey = "data-title";
            const customTitle =
                titleKey in props && typeof props[titleKey] === "string"
                    ? props[titleKey]
                    : undefined;
            const title = customTitle ? <Markdown inline markdown={customTitle} /> : "Info";
            return <Info title={title}>{props.children}</Info>;
        }

        return <div {...props} />;
    },

    span({ node, ...props }) {
        if (props.className === "katex-display") {
            return (
                <div data-wide className="MathWrapper">
                    <span {...props} />
                </div>
            );
        }

        // mark short math snippets
        if (props.className === "katex" && node) {
            const text = nodeTextContent(node);
            if (text.length <= 16) {
                props.className += " short-math";
            }
        }

        return <span {...props} />;
    },

    p({ children, node, ...props }) {
        const { inline } = useContext(MarkdownContext);
        if (inline) {
            return <>{children}</>;
        }

        // remove wrapping p if the only child is an <img>
        if (
            node &&
            node.children.length === 1 &&
            node.children[0].type === "element" &&
            node.children[0].tagName === "img"
        ) {
            return <>{children}</>;
        }

        return <p {...props}>{children}</p>;
    },

    async img({ src, alt, ...props }) {
        const { getImage } = useContext(MarkdownContext);

        let width, height;
        if (getImage && src) {
            try {
                const info = await getImage(src);
                src = info.src;
                width = info.width;
                height = info.height;
            } catch (error) {
                console.error(`Error fetching image info for ${src}:`, error);
            }
        }

        return <Image src={src} alt={alt} width={width as any} height={height as any} {...props} />;
    },
} satisfies Partial<Components>;

function MarkdownRenderer({ markdown }: { markdown: string }) {
    return (
        <ReactMarkdown
            components={staticComponents}
            rehypePlugins={[
                rehypeCodeMeta,
                rehypeRaw,
                rehypeSlug,
                [
                    rehypeKatex,
                    {
                        output: "html",
                        strict: true,
                        throwOnError: false,
                        errorColor: "#f44",
                        globalGroup: true,
                        macros: {
                            // FIXME: This is currently a hack to work
                            // around the fact that global macros don't work.
                            "\\round": "\\operatorname{round}",
                        },
                    },
                ],
            ]}
            remarkPlugins={[remarkGfm, remarkToc, remarkMath]}
        >
            {markdown}
        </ReactMarkdown>
    );
}

interface MarkdownProps {
    markdown: string;
    inline?: boolean;
    inlineCodeLanguage?: string;
    componentInsertFunction?: string;
    getImage?: (url: string) => Promise<ImageInfo>;
}

export function Markdown({
    markdown,
    inline = false,
    inlineCodeLanguage = "plain",
    componentInsertFunction,
    getImage,
}: MarkdownProps) {
    return (
        <MarkdownContext.Provider
            value={{
                inline,
                inlineCodeLanguage,
                componentInsertFunction,
                getImage,
            }}
        >
            <MarkdownRenderer markdown={markdown} />
        </MarkdownContext.Provider>
    );
}
