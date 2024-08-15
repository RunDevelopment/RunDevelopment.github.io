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
            className="border-b border-dotted border-current pb-[2px] text-blue-400 transition-colors visited:text-violet-400 hover:border-solid hover:text-blue-300 visited:hover:text-violet-300"
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            title={title}
        >
            {children}
            {external && <FaExternalLinkAlt className="ml-1 inline-block w-3 align-baseline" />}
        </Link>
    );
}
