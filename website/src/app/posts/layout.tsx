import React from "react";
import BasicPage from "../../components/BasicPage";

export default function Layout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return <BasicPage>{children}</BasicPage>;
}
