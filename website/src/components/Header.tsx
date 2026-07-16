import Link from "next/link";
import React from "react";
import { getInlineImage } from "../lib/fs/util";
import "./Header.css";

type HeaderLinkProps = {
    href: string;
    children: React.ReactNode;
    kind: HeaderLink;
    className?: string;
};
function HeaderLink({ href, children, kind, className = "" }: HeaderLinkProps) {
    return (
        <Link
            href={href}
            data-link-kind={kind}
            className={
                className +
                " flex h-8 items-center transition-colors text-neutral-200 hover:text-white"
            }
        >
            {children}
        </Link>
    );
}

export type HeaderLink = "home" | "blog" | "projects";

/**
 * See PageSettings to modify the header.
 */
export default async function Header() {
    // inline the logo image, so it doesn't blink on page load
    const logo = await getInlineImage("logo256_opaque.webp");

    return (
        <header className="z-10 w-full bg-black">
            <div className="z-10 mx-auto box-content max-w-[calc(var(--header-width)+1.5rem)] p-1">
                <nav className="box-content flex rounded-full bg-black/60 p-3 align-middle xs:text-lg">
                    <HeaderLink href="/" className="group pr-3" kind="home">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={logo}
                            alt="Logo"
                            width="32"
                            height="32"
                            className="mr-3 inline h-full rounded-full transition-transform duration-[400ms] group-hover:rotate-[360deg] group-hover:scale-125"
                        />
                        <span>About</span>
                    </HeaderLink>
                    <span className="grow" />
                    <HeaderLink href="/blog" className="px-3" kind="blog">
                        Blog
                    </HeaderLink>
                    <HeaderLink href="/projects" className="px-3" kind="projects">
                        Projects
                    </HeaderLink>
                </nav>
            </div>
        </header>
    );
}
