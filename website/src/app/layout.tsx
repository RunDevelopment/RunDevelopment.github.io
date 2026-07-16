import React from "react";
import Header from "../components/Header";
import "./globals.css";

const FONT_CSS = String.raw`
@import url('https://fonts.googleapis.com/css2?family=Montserrat:ital,wght@0,100..900;1,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&family=Source+Code+Pro:ital@0;1&family=Source+Serif+4:ital,opsz,wght@0,8..60,200..900;1,8..60,200..900&display=swap');

:root {
    --font-sans: 'Roboto', 'Segoe UI', 'Arial', 'sans-serif' !important;
    --font-serif: 'Source Serif 4', 'Source Serif', 'Georgia', 'Times New Roman', 'serif';
    --font-header: 'Montserrat', 'Open Sans', 'sans-serif';
    --font-mono: 'Source Code Pro', 'monospace';
}
`
    .trim()
    .replace(/\s*\n\s*/g, "");

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body className="font-sans text-zinc-200">
                <style>{FONT_CSS}</style>
                <Header />
                {children}
            </body>
        </html>
    );
}
