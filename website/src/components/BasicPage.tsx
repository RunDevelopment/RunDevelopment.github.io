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
            data-selected={selected ? "" : undefined}
            className={
                className +
                " flex h-8 items-center transition-colors text-neutral-200 hover:text-white"
            }
        >
            {children}
        </Link>
    );
}

type HeaderLinks = "home" | "blog" | "projects";

async function Header({
    selectedLink,
    fancy = false,
}: {
    selectedLink?: HeaderLinks;
    fancy?: boolean;
}) {
    // inline the logo image, so it doesn't blink on page load
    const logo = await getInlineImage("logo256_opaque.webp");

    return (
        <header
            className="z-10 w-full bg-black md:data-[fancy]:absolute md:data-[fancy]:bg-transparent"
            data-fancy={fancy ? "" : undefined}
        >
            <div className="z-10 mx-auto box-content max-w-[calc(var(--page-narrow-width)+1.5rem)] p-1">
                <nav
                    className="box-content flex rounded-full bg-black/60 p-3 align-middle md:data-[fancy]:backdrop-blur-md xs:text-lg"
                    data-fancy={fancy ? "" : undefined}
                >
                    <HeaderLink href="/" className="group pr-3" selected={selectedLink === "home"}>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={logo}
                            alt="Logo"
                            width="32"
                            height="32"
                            className="mr-3 inline h-full rounded-full transition-transform duration-[400ms] group-hover:rotate-[360deg] group-hover:scale-125"
                        />
                        <span>Home</span>
                    </HeaderLink>
                    <span className="grow" />
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
            </div>
        </header>
    );
}

export interface BasicPageProps {
    children: React.ReactNode;
    selectedLink?: HeaderLinks;
    fancyHeader?: boolean;
}
export default async function BasicPage({ children, selectedLink, fancyHeader }: BasicPageProps) {
    return (
        <body className={allFonts + " font-sans overflow-y-scroll bg-zinc-900 text-zinc-200"}>
            <Header selectedLink={selectedLink} fancy={fancyHeader} />
            <main className="mx-auto box-content max-w-[var(--page-width)] px-4 pb-8 contain-size md:px-6">
                {children}
            </main>
        </body>
    );
}
