"use client";

import React, { useState } from "react";
import type { PostsInfo } from "../../lib/fs/posts-info";
import { TagView } from "../../components/TagList";
import { PostCard } from "../../components/PostCard";
import { H2 } from "../headings";

export default function PostsPage({ info }: { info: PostsInfo }) {
    const { allTags, byYear } = info;
    const [selectedTag, setSelectedTag] = useState<string | undefined>();

    return (
        <div className="narrow-container py-8">
            <div className="narrow flex flex-wrap gap-2">
                {allTags.map((tag) => (
                    <TagView
                        key={tag}
                        tag={tag}
                        selected={tag === selectedTag}
                        onClick={() => {
                            setSelectedTag(tag === selectedTag ? undefined : tag);
                        }}
                    />
                ))}
            </div>
            {byYear.map(([year, posts]) => {
                if (selectedTag) {
                    posts = posts.filter((post) => post.tags.includes(selectedTag));
                }
                if (posts.length === 0) {
                    return null;
                }

                return (
                    <React.Fragment key={year}>
                        <H2>{year}</H2>
                        <div className="narrow">
                            {posts.map((post) => (
                                <PostCard key={post.slug} meta={post} />
                            ))}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}
