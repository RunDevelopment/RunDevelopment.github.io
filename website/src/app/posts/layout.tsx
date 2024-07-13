import Link from "next/link";
import React from "react";

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <div className="m-auto flex max-w-[960px] flex-col px-6 py-8 md:flex-row">
            <nav className="box-border w-48 shrink-0">
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
