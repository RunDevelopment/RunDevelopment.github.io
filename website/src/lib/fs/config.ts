import path from "path";

export const IS_DEV = typeof process !== "undefined" && process.env.NODE_ENV === "development";
export const POST_DIR = path.join(process.cwd(), "../posts");
export const IMAGES_DIR = path.join(process.cwd(), "public/images");
export const IMAGE_CACHE_DIR = path.join(process.cwd(), "./.image_cache");
export const ASSET_DIR = path.join(process.cwd(), "public");
