import { type ReactNode, type JSX } from "react";
import * as z from "zod";

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

export interface Component {
    type: string;
    props?: Record<string, any>;
}
const componentSchema = z.object({
    type: z.string(),
    props: z.record(z.string(), z.any()).optional(),
});
export function getComponents(markdown: string): Component[] {
    const regex = /^```json:component\s*\n([\s\S]*?)\n```$/gm;
    const components: Component[] = [];
    let match;
    while ((match = regex.exec(markdown)) !== null) {
        const json = match[1];
        const error = (message: string): Component => ({
            type: "Error",
            props: { message, code: json, lang: "json" },
        });

        let raw;
        try {
            raw = JSON.parse(match[1]);
        } catch (e) {
            components.push(error("Failed to parse component JSON: " + e));
            continue;
        }

        let component;
        try {
            component = componentSchema.parse(raw);
        } catch (e) {
            components.push(error("Invalid component JSON: " + e));
            continue;
        }

        components.push(component);
    }
    return components;
}

export function parseMetaString(metaString: string): Record<string, string | boolean> {
    const meta: Record<string, string | boolean> = {};

    const regex = /@([\w-]+)(?:=(?:"([^"]+)"|(\S+)))?/g;
    let match;
    while ((match = regex.exec(metaString)) !== null) {
        const key = match[1];
        if (match[2] !== undefined) {
            // use string values directly
            meta[key] = match[2];
        } else if (match[3] !== undefined) {
            // parse value
            const s = match[3];
            const value = s === "true" ? true : s === "false" ? false : s;
            meta[key] = value;
        } else {
            // default to true
            meta[key] = true;
        }
    }

    return meta;
}
