import React from "react";
import { Metadata } from "next";
import { Footer } from "./Footer";
import { Article } from "./Article";
import { getPostFromSlug, getPosts } from "../../../lib/fs/uptodate";
import BasicPage from "../../../components/BasicPage";

interface Props {
    params: Promise<{ slug: string }>;
}

export default async function Page(props: Props) {
    const params = await props.params;
    const post = await getPostFromSlug(params.slug);
    if (!post) {
        throw new Error("Post " + params.slug + " not found");
    }

    return (
        <BasicPage selectedLink="blog" fancyHeader={!!post.metadata.image}>
            <Article post={post} />
            <Footer />
        </BasicPage>
    );
}

export async function generateMetadata(props: Props): Promise<Metadata> {
    const params = await props.params;
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
