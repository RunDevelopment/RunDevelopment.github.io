import React from "react";
import { Metadata } from "next";
import BasicPage from "../../components/BasicPage";
import { SolutionVisualizer } from "./vis";

export const metadata: Metadata = {
    title: "Test",
};

export default function Page() {
    return (
        <BasicPage selectedLink="projects">
            <div className="narrow-container py-8">
                <SolutionVisualizer />
            </div>
        </BasicPage>
    );
}
