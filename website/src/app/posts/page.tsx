import { getPosts } from "../../lib/fs/posts";
import Link from "next/link";

export default async function Page() {
    const posts = await getPosts();
    return (
        <div>
            Posts:
            {posts.map((post) => (
                <div key={post.id}>
                    <Link href={`/posts/${post.metadata.slug}`}>
                        <h2>{post.metadata.title}</h2>
                    </Link>
                </div>
            ))}
        </div>
    );
}
