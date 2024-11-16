import React from "react";
import { Metadata } from "next";
import BasicPage from "../../../components/BasicPage";
import { ConversionConstantsSearch } from "./ConversionConstantsSearch";

export const metadata: Metadata = {
    title: "Multiply-Add Constants Finder by RunDev",
    description: "A tool to find multiply-add constants for a given set of numbers.",
    authors: {
        name: "Michael Schmidt",
    },
    openGraph: {
        type: "website",
    },
};

export default function Page() {
    return (
        <BasicPage selectedLink="projects">
            <div className="narrow-container py-8">
                <p>asdasd</p>
                <ConversionConstantsSearch />
            </div>
        </BasicPage>
    );
}
