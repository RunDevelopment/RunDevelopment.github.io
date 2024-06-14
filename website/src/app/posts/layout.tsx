import Link from "next/link";
import React from "react";

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="max-w-[1000px] m-auto flex flex-row px-4 py-8">
            <nav className="shrink-0 w-48 box-border">
                <ul>
                    <li className="mb-6">
                        <Link href="/">Home</Link>
                    </li>
                    <li className="mb-6">
                        <Link href="/posts">Posts</Link>
                    </li>
                    <li className="mb-6">
                        <Link href="/about">About</Link>
                    </li>
                </ul>
            </nav>
            <main className="grow contain-size">{children}</main>
        </div>
    );
}
