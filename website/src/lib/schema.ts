export type InternalPostId = string & { __internalPostId: never };

export interface Post {
    metadata: PostMetadata;
    markdown: string;
    imageUrlMapping: Record<string, string>;
    imageSizes: Record<string, ImageSize>;
}

export interface PostWithInternals {
    post: Post;
    id: InternalPostId;
    referencedImageFiles: Record<string, string>;
}

export interface PostMetadata {
    title: string;
    description: string;
    slug: string;
    datePublished: string;
    dateModified: string;
    draft: boolean;
    inlineCodeLanguage?: string;
    tags: readonly string[];
    color: string;
    image?: string;
    imageSmall?: string;
    minutesToRead: number;
}

export interface ImageSize {
    width: number;
    height: number;
}
