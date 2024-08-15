"use client";

import React, { useState } from "react";
import { H1 } from "../../components/md/Markdown";
import { PostsInfo } from "../../lib/posts-info";
import { TagView } from "../../components/TagList";
import { PostCard } from "../../components/PostCard";

export default function PostsPage({ info }: { info: PostsInfo }) {
    const { allTags, byYear } = info;
    const [selectedTag, setSelectedTag] = useState<string | undefined>();

    return (
        <div className="py-8">
            <H1>Posts</H1>
            <div className="flex flex-wrap gap-2">
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
                    posts = posts.filter((post) => post.metadata.tags.includes(selectedTag));
                }
                if (posts.length === 0) {
                    return null;
                }

                return (
                    <React.Fragment key={year}>
                        <h2 className="mb-8 mt-4 pt-8 text-2xl text-white md:text-3xl">{year}</h2>
                        {posts.map((post) => (
                            <PostCard key={post.id} meta={post.metadata} />
                        ))}
                    </React.Fragment>
                );
            })}
        </div>
    );
}
