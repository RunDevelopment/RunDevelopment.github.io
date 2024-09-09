import Link from "next/link";
import React from "react";
import "./BasicPage.css";

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
                (selected ? " bg-white/10" : "") +
                " flex h-8 items-center text-neutral-400 transition-colors hover:text-white"
            }
        >
            {children}
        </Link>
    );
}

type HeaderLinks = "home" | "blog" | "projects";

function Header({ selectedLink }: { selectedLink?: HeaderLinks }) {
    return (
        <header className="bg-black">
            <nav className="z-10 mx-auto box-content flex max-w-[var(--page-narrow-width)] gap-8 p-4 align-middle">
                <HeaderLink href="/" className="group" selected={selectedLink === "home"}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/favicon.ico"
                        alt="logo"
                        width="32"
                        height="32"
                        className="mr-2 inline h-full transition-transform duration-300 group-hover:rotate-[360deg] group-hover:scale-125"
                    />
                    <span>Home</span>
                </HeaderLink>
                <HeaderLink href="/blog" selected={selectedLink === "blog"}>
                    Blog
                </HeaderLink>
                <HeaderLink href="/projects" selected={selectedLink === "projects"}>
                    Projects
                </HeaderLink>
            </nav>
        </header>
    );
}

export function PageRoot({ children }: { children: React.ReactNode }) {
    return <body className={" bg-zinc-900 text-zinc-200"}>{children}</body>;
}

export default function BasicPage({
    children,
    selectedLink,
}: {
    children: React.ReactNode;
    selectedLink?: HeaderLinks;
}) {
    return (
        <PageRoot>
            <Header selectedLink={selectedLink} />
            <div className="m-auto box-content max-w-[var(--page-width)] px-4 pb-8 md:px-6">
                <main className="contain-size">{children}</main>
            </div>
        </PageRoot>
    );
}
