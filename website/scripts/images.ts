import { getPostsWithInternals } from "../src/lib/fs/posts";
import { updateImageFiles } from "../src/lib/fs/uptodate";

async function run() {
    const posts = await getPostsWithInternals();
    await updateImageFiles(posts, false);
}

run().then(() => console.log("Done."), console.error);
