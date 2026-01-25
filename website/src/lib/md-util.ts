import { ReactNode, type JSX } from "react";

export type MdElement = NonNullable<import("hast-util-to-jsx-runtime").ExtraProps["node"]>;

export type FunctionComponent<ComponentProps> = (props: ComponentProps) => ReactNode;
export type ExtraProps = { node?: MdElement | undefined };
export type Components = {
    [TagName in keyof JSX.IntrinsicElements]: FunctionComponent<
        JSX.IntrinsicElements[TagName] & ExtraProps
    >;
};

export function getTextContent(children: React.ReactNode, node: MdElement | undefined): string {
    if (typeof children === "string") {
        return children;
    }
    if (children == null) {
        return "";
    }
    if (node) {
        return nodeTextContent(node);
    }

    return String(children);
}

export function nodeTextContent(n: import("hast").ElementContent): string {
    if (n.type === "text") {
        return n.value;
    }
    if (n.type === "element") {
        return n.children.map(nodeTextContent).join("");
    }
    return "";
}

export function getHeadingId(text: string): string {
    return text
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
}

interface Heading {
    level: number;
    text: string;
    id: string;
}
export function getAllHeadings(markdown: string): Heading[] {
    const headings: Heading[] = [];
    const lines = markdown.split("\n");
    for (const line of lines) {
        const match = line.match(/^(#+)\s+(.*)/);
        if (match) {
            const text = match[2];
            headings.push({
                level: match[1].length,
                text,
                id: getHeadingId(text),
            });
        }
    }
    return headings;
}
