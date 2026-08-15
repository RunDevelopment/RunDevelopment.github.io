import { defineCollection } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const blog = defineCollection({
    // Load Markdown and MDX files in the `src/content/blog/` directory.
    loader: glob({
        base: "./src/content/blog",
        pattern: "**/*.{md,mdx}",
        retainBody: true,
    }),
    // Type-check frontmatter using a schema
    schema: () =>
        z.object({
            title: z.string(),
            description: z.string(),

            // Transform string to Date object
            datePublished: z.coerce.string(),
            dateModified: z.coerce.string().optional(),

            draft: z.boolean().default(false),
            inlineCodeLanguage: z.string().optional(),
            slug: z.string().optional(),
            tags: z.string().default(""),

            accent: z.string().optional(),
            image: z.string().optional(),
            imageFadeColor: z.string().optional(),
        }),
});

export const collections = { blog };
