export type InternalPostId = string & { __internalPostId: never };

export interface Post {
    id: InternalPostId;
    metadata: PostMetadata;
    markdown: string;
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
    minutesToRead: number;
}
