import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Regex Crossword by RunDev",
    description: "A hexagonal crossword puzzle game based on regular expressions.",
    authors: {
        name: "Michael Schmidt",
    },
    openGraph: {
        type: "website",
    },
};

export default function Page() {
    return <div>Regex Crossword</div>;
}
