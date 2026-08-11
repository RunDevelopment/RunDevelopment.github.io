import { type PropsWithChildren } from "react";
import { getDomain } from "../lib/util";
import "./TextLink.css";

interface TextLinkProps {
    href: string;
}

export function TextLink({ href, children }: PropsWithChildren<TextLinkProps>) {
    const external = href.startsWith("http");

    const title = external ? "Go to " + getDomain(href) : undefined;

    return (
        <a
            href={href}
            className="TextLink"
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            title={title}
        >
            {children}
        </a>
    );
}
