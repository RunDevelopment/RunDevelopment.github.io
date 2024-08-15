import { Metadata } from "next";
import BasicPage from "../components/BasicPage";
import { getPostsInfo } from "../lib/posts-info";
import { PostCard } from "../components/PostCard";
import { TextLink } from "../components/md/TextLink";
import Link from "next/link";

export const metadata: Metadata = {
    title: "RunDev",
    authors: {
        name: "Michael Schmidt",
    },
};

async function getRecentPosts(topK: number) {
    const { byYear } = await getPostsInfo();
    const posts = byYear.flatMap(([, posts]) => posts).map((post) => post.metadata);
    return posts.slice(0, topK);
}

export default async function Home() {
    const recentPosts = await getRecentPosts(3);

    return (
        <BasicPage>
            <div className="py-8">
                <p className="my-6">
                    Hi! I&apos;m Michael, also known as RunDev or RunDevelopment throughout the
                    internet. I&apos;m a software engineer from Germany with an interest in computer
                    science and mathematics.
                </p>

                <h2 className="mb-8 mt-4 pt-8 text-2xl text-white md:text-3xl">
                    Where you can find me
                </h2>
                <p>
                    I&apos;m not big on social media of any kind and rarely post anything, if at
                    all. That said:
                </p>
                <ul className="my-6 list-inside list-disc">
                    <li>
                        Github:{" "}
                        <TextLink href="https://github.com/RunDevelopment">
                            @RunDevelopment
                        </TextLink>
                    </li>
                </ul>

                <h2 className="mb-8 mt-4 pt-8 text-2xl text-white md:text-3xl">Recent posts</h2>
                {recentPosts.map((post) => (
                    <PostCard key={post.slug} meta={post} showYear />
                ))}
                <p className="my-6 text-center text-lg">
                    <Link href="/posts" className="text-blue-300 hover:text-blue-400">
                        Show all posts...
                    </Link>
                </p>
            </div>
        </BasicPage>
    );
}
