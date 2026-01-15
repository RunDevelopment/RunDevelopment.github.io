import React from "react";
import BlogPage from "./BlogPage";
import { getPostsInfo } from "../../lib/fs/posts-info";
import { Metadata } from "next";
import BasicPage from "../../components/BasicPage";

export const metadata: Metadata = {
    title: "Blog by RunDev",
    authors: {
        name: "Michael Schmidt",
    },
    openGraph: {
        type: "website",
    },
};

export default async function Page() {
    const info = await getPostsInfo();

    return (
        <BasicPage selectedLink="blog">
            <BlogPage info={info} />
        </BasicPage>
    );
}
