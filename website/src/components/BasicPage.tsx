import Link from "next/link";
import React from "react";

function HeaderLink({
    href,
    children,
    className = "",
}: Readonly<{ href: string; children: React.ReactNode; className?: string }>) {
    return (
        <Link
            href={href}
            className={
                className +
                " flex h-8 items-center text-neutral-400 transition-colors hover:text-white"
            }
        >
            {children}
        </Link>
    );
}

function Header() {
    return (
        <header className="">
            <nav className="flex gap-8 py-4 align-middle">
                <HeaderLink href="/" className="group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src="/favicon.ico"
                        alt="logo"
                        className="mr-2 inline h-full transition-transform duration-300 group-hover:rotate-[360deg] group-hover:scale-125"
                    />
                    <span>Home</span>
                </HeaderLink>
                <HeaderLink href="/posts">Posts</HeaderLink>
            </nav>
            <div className="absolute left-0 h-px w-full bg-zinc-700" />
        </header>
    );
}

export default function BasicPage({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="m-auto max-w-[calc(800px+3rem)] px-4 pb-8 md:px-6">
            <Header />
            <main className="contain-size">{children}</main>
        </div>
    );
}
