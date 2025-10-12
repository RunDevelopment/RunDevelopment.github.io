import Link from "next/link";
import React from "react";
import { allFonts } from "../fonts/fonts";
import "./BasicPage.css";
import { getInlineImage } from "../lib/fs/util";

type HeaderLinkProps = {
    href: string;
    children: React.ReactNode;
    selected?: boolean;
    className?: string;
};
function HeaderLink({ href, children, selected, className = "" }: HeaderLinkProps) {
    return (
        <Link
            href={href}
            className={
                className +
                (selected ? " text-white" : " text-neutral-400") +
                " flex h-8 items-center transition-colors hover:text-white"
            }
        >
            {children}
        </Link>
    );
}

type HeaderLinks = "home" | "blog" | "projects";

async function Header({ selectedLink }: { selectedLink?: HeaderLinks }) {
    // inline the logo image, so it doesn't blink on page load
    const logo = await getInlineImage("logo256_opaque.webp");

    return (
        <header className="bg-black">
            <nav className="z-10 mx-auto box-content flex max-w-[var(--page-narrow-width)] gap-1 p-4 align-middle">
                <HeaderLink href="/" className="group pr-3" selected={selectedLink === "home"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={logo}
                        alt="Logo"
                        width="32"
                        height="32"
                        className="mr-2 rounded-full inline h-full transition-transform duration-300 group-hover:rotate-[360deg] group-hover:scale-125"
                    />
                    <span>Home</span>
                </HeaderLink>
                <HeaderLink href="/blog" className="px-3" selected={selectedLink === "blog"}>
                    Blog
                </HeaderLink>
                <HeaderLink
                    href="/projects"
                    className="px-3"
                    selected={selectedLink === "projects"}
                >
                    Projects
                </HeaderLink>
            </nav>
        </header>
    );
}

export interface BasicPageProps {
    children: React.ReactNode;
    selectedLink?: HeaderLinks;
    alwaysShowScrollBar?: boolean;
}
export default async function BasicPage({
    children,
    selectedLink,
    alwaysShowScrollBar,
}: BasicPageProps) {
    return (
        <body
            className={
                (alwaysShowScrollBar ? "overflow-y-scroll" : "") +
                " " +
                allFonts +
                " font-sans bg-zinc-900 text-zinc-200"
            }
        >
            <Header selectedLink={selectedLink} />
            <main className="mx-auto box-content max-w-[var(--page-width)] px-4 pb-8 contain-size md:px-6">
                {children}
            </main>
        </body>
    );
}
