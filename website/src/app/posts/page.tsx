import React from "react";
import PostsPage from "./PostsPage";
import { getPostsInfo } from "../../lib/posts-info";
import { Metadata } from "next";

export const metadata: Metadata = {
    title: "Posts by RunDev",
    authors: {
        name: "Michael Schmidt",
    },
    openGraph: {
        type: "article",
        authors: ["Michael Schmidt"],
    },
};

export default async function Page() {
    const info = await getPostsInfo();

    return <PostsPage info={info} />;
}
