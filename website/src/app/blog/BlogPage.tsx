"use client";

import React, { useEffect, useState } from "react";
import type { PostsInfo } from "../../lib/fs/posts-info";
import { TagButton } from "../../components/TagList";
import { PostCard } from "../../components/PostCard";
import { H2 } from "../headings";

export default function PostsPage({ info }: { info: PostsInfo }) {
    const { allTags, byYear } = info;
    const [selectedTag, setSelectedTag] = useState<string | undefined>();

    useEffect(() => {
        const hash = decodeURIComponent(window.location.hash.slice(1));
        if (allTags.includes(hash)) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setSelectedTag(hash);
        }
    }, [allTags]);

    useEffect(() => {
        window.history.replaceState(
            null,
            "",
            selectedTag ? `#${encodeURIComponent(selectedTag)}` : window.location.pathname,
        );
    }, [selectedTag]);

    return (
        <div className="narrow-container py-8">
            <div className="narrow flex flex-wrap gap-2">
                {allTags.map((tag) => (
                    <TagButton
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
