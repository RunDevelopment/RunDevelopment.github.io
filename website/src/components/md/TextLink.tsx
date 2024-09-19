import Link from "next/link";
import { PropsWithChildren } from "react";
import { FaExternalLinkAlt } from "react-icons/fa";

interface TextLinkProps {
    href: string;
    simple?: boolean;
}

export function TextLink({ href, simple, children }: PropsWithChildren<TextLinkProps>) {
    const external = href.startsWith("http");

    const title = external ? "Go to " + new URL(href).host : undefined;

    return (
        <Link
            href={href}
            className={
                (simple
                    ? "hover:border-b"
                    : "border-b border-dotted visited:text-violet-400 visited:hover:text-violet-300") +
                " border-current pb-[2px] text-blue-400 transition-colors hover:border-solid hover:text-blue-300 print:border-none"
            }
            target={external ? "_blank" : undefined}
            rel={external ? "noopener noreferrer" : undefined}
            title={title}
        >
            {children}
            {external && <FaExternalLinkAlt className="ml-1 inline-block w-3 align-baseline" />}
        </Link>
    );
}
