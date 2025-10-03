import React from "react";
import { Metadata } from "next";
import { GamePage } from "./Board";

export const metadata: Metadata = {
    title: "Connect 4444",
    description: "PLay Connect Four against AI or other players.",
    authors: {
        name: "Michael Schmidt",
    },
    openGraph: {
        type: "website",
    },
};

export default function Page() {
    return <GamePage />;
}
