import React from "react";
import Header from "../components/Header";
import { allFonts } from "../fonts/fonts";
import "./globals.css";

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className={allFonts + " font-sans text-zinc-200"}>
                <Header />
                {children}
            </body>
        </html>
    );
}
