import { getPostFromSlug, getPosts } from "../../../lib/fs/posts";
import { Metadata } from "next";
import React from "react";
import { Footer } from "./Footer";
import { Article } from "./Article";

interface Props {
    params: { slug: string };
}

export default async function Page({ params }: Props) {
    const post = await getPostFromSlug(params.slug);
    if (!post) {
        throw new Error("Post " + params.slug + " not found");
    }

    return (
        <div>
            <Article post={post} />
            <Footer />
        </div>
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const post = await getPostFromSlug(params.slug);
    if (!post) {
        throw new Error("Post " + params.slug + " not found");
    }

    return {
        title: post.metadata.title + " - RunDev",
        authors: {
            name: "Michael Schmidt",
        },
        openGraph: {
            type: "article",
            authors: ["Michael Schmidt"],
            publishedTime: post.metadata.datePublished,
            modifiedTime: post.metadata.dateModified,
            title: post.metadata.title,
        },
    };
}

export async function generateStaticParams() {
    const posts = await getPosts();

    return posts.map((post) => ({
        slug: post.metadata.slug,
    }));
}
