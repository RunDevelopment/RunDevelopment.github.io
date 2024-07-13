import Link from "next/link";
import { PropsWithChildren } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";

interface TextLinkProps {
    href: string;
}

export function TextLink({ href, children }: PropsWithChildren<TextLinkProps>) {
    const external = href.startsWith("http");

    const title = external ? "Go to " + new URL(href).host : undefined;

    return (
        <Link
            href={href}
            className="border-b border-dotted border-current pb-[2px] text-sky-500 visited:text-violet-500 hover:border-solid hover:text-sky-400 visited:hover:text-violet-400"
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            title={title}
        >
            {children}
            {external && <FaExternalLinkAlt className="ml-1 inline-block w-3 align-baseline" />}
        </Link>
    );
}
