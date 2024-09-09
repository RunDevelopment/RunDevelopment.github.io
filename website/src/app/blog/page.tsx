import React from "react";
import BlogPage from "./BlogPage";
import { getPostsInfo } from "../../lib/fs/posts-info";
import { Metadata } from "next";

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

    return <BlogPage info={info} />;
}
