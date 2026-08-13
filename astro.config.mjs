// @ts-check

import react from "@astrojs/react";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, passthroughImageService } from "astro/config";
// import minify from "astro-minify-html-swc";

// https://astro.build/config
export default defineConfig({
    site: "https://rundev.me",

    prefetch: {
        prefetchAll: true,
    },

    image: {
        service: passthroughImageService(),
    },

    // I have my own custom markdown pipeline, so there's no reason to waste time syntax highlighting
    markdown: {
        syntaxHighlight: false,
    },

    integrations: [
        react(),
        // minify(), // IMPORTANT: Must be last
    ],

    vite: {
        plugins: [tailwindcss()],
    },
});
