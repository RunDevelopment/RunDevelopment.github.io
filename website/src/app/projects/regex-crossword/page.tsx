import React from "react";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Regex Crossword",
    authors: {
        name: "Michael Schmidt",
    },
    openGraph: {
        type: "article",
        authors: ["Michael Schmidt"],
    },
};

export default function Page() {
    return <div>Regex crossword</div>;
}
