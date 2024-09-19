import { Metadata } from "next";
import BasicPage from "../components/BasicPage";
import { getPostsInfo } from "../lib/fs/posts-info";
import { PostCard } from "../components/PostCard";
import { TextLink } from "../components/md/TextLink";
import Link from "next/link";
import { H2 } from "./headings";

export const metadata: Metadata = {
    title: "RunDev",
    authors: {
        name: "Michael Schmidt",
    },
};

async function getRecentPosts(topK: number) {
    const { byYear } = await getPostsInfo();
    const posts = byYear.flatMap(([, posts]) => posts);
    return posts.slice(0, topK);
}

export default async function Home() {
    const recentPosts = await getRecentPosts(3);

    return (
        <BasicPage selectedLink="home">
            <div className="narrow-container py-8">
                <H2>About me</H2>
                <p className="my-4">
                    Hi! I&apos;m Michael, also known as RunDev or RunDevelopment throughout the
                    internet. I&apos;m a software developer from Germany with many interests.
                </p>
                <p className="my-4">
                    Pretty much everything I do is open source and can be found on my Github, but
                    some of my projects are only also listed on this website.
                </p>
                <p className="my-4">
                    Sometimes <TextLink href="/blog">I write about things</TextLink> I find
                    interesting.
                </p>

                <H2>Where you can find me</H2>
                <p>
                    I&apos;m not big on social media of any kind and rarely post anything, if at
                    all. That said:
                </p>
                <ul className="narrow my-6 list-inside list-disc">
                    <li>
                        Github:{" "}
                        <TextLink href="https://github.com/RunDevelopment">
                            @RunDevelopment
                        </TextLink>
                    </li>
                </ul>

                <H2>Recent posts</H2>
                <div className="narrow">
                    {recentPosts.map((post) => (
                        <PostCard key={post.slug} meta={post} showYear />
                    ))}
                    <p className="my-6 text-center text-lg">
                        <Link href="/blog" className="text-blue-300 hover:text-blue-400">
                            Show all posts...
                        </Link>
                    </p>
                </div>
            </div>
        </BasicPage>
    );
}
