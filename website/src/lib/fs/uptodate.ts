import path from "path";
import fs from "fs/promises";
import deepEqual from "fast-deep-equal";
import { Post, PostWithInternals } from "../schema";
import { getPostsWithInternals } from "./posts";
import { timedCached } from "../util";

let lastImageMapping: unknown = null;

export const getPosts = timedCached(2000, async () => {
    const internals = await getPostsWithInternals();

    // update images
    const imageMapping = new Map(
        internals.map((post) => [post.post.metadata.slug, post.referencedImageFiles] as const),
    );
    if (!deepEqual(imageMapping, lastImageMapping)) {
        lastImageMapping = imageMapping;
        await updateImageFiles(internals, true);
    }

    return internals.map((post) => post.post);
});

export const getPostFromSlug = async (slug: string): Promise<Post | undefined> => {
    const posts = await getPosts();
    return posts.find((post) => post.metadata.slug === slug);
};

function getFilesMapping(posts: Iterable<PostWithInternals>, ignoreErrors: boolean) {
    const byFile: [file: string, name: string][] = [];
    const byName = new Map<string, string>();

    for (const post of posts) {
        for (const [file, name] of Object.entries(post.referencedImageFiles)) {
            const conflict = byName.get(name);
            if (conflict) {
                console.error("Duplicate file name: " + name);
                console.error("  ", file);
                console.error("  ", conflict);
                if (ignoreErrors) {
                    continue;
                }
                throw new Error("Duplicate file name: " + name);
            }

            byName.set(name, file);
            byFile.push([file, name]);
        }
    }

    return byFile;
}

const IMAGES_DIR = path.join(process.cwd(), "public/images");

export async function updateImageFiles(posts: readonly PostWithInternals[], ignoreErrors = false) {
    const fileMapping = getFilesMapping(posts, ignoreErrors);

    console.log(`Copying ${fileMapping.length} images...`);

    // clean images folder
    await fs.rm(IMAGES_DIR, { recursive: true, force: true });
    await fs.mkdir(IMAGES_DIR, { recursive: true });

    // copy all image files
    await Promise.all(
        fileMapping.map(async ([file, name]) => {
            const dest = path.join(IMAGES_DIR, name);
            await fs.copyFile(file, dest);
        }),
    );
}
