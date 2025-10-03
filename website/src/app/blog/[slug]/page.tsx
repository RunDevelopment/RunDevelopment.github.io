import { Metadata } from "next";
import React from "react";
import { Footer } from "./Footer";
import { Article } from "./Article";
import { getPostFromSlug, getPosts } from "../../../lib/fs/uptodate";

interface Props {
    params: { slug: string };
}

export default async function Page({ params }: Props) {
    const post = await getPostFromSlug(params.slug);
    if (!post) {
        throw new Error("Post " + params.slug + " not found");
    }

    return (
        <>
            <Article post={post} />
            <Footer />
        </>
    );
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
    const post = await getPostFromSlug(params.slug);
    if (!post) {
        throw new Error("Post " + params.slug + " not found");
    }

    return {
        title: post.metadata.title + " - RunDev",
        description: post.metadata.description,
        keywords: post.metadata.tags.join(", "),
        authors: {
            name: "Michael Schmidt",
        },
        openGraph: {
            type: "article",
            authors: ["Michael Schmidt"],
            publishedTime: post.metadata.datePublished,
            modifiedTime: post.metadata.dateModified,
            title: post.metadata.title,
            description: post.metadata.description,
        },
    };
}

export async function generateStaticParams() {
    const posts = await getPosts();

    return posts.map((post) => ({
        slug: post.metadata.slug,
    }));
}
