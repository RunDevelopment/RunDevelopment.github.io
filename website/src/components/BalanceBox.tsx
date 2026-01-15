"use client";

import { useEffect } from "react";

export function BalanceBox() {
    useEffect(() => {
        fitAllToLongestLine();

        // update on font load
        document.fonts.ready.then(fitAllToLongestLine);

        // update on window resize
        let timerRunning = false;
        const debouncedUpdate = () => {
            if (timerRunning) {
                return;
            }
            timerRunning = true;
            setTimeout(() => {
                timerRunning = false;
                fitAllToLongestLine();
            }, 100);
        };
        window.addEventListener("resize", debouncedUpdate);
        return () => {
            window.removeEventListener("resize", debouncedUpdate);
        };
    }, []);

    return <></>;
}

function fitAllToLongestLine() {
    document.querySelectorAll(".balanced-box").forEach(fitToLongestLine);
}
function fitToLongestLine(element: Element) {
    if (!(element instanceof HTMLElement)) {
        return;
    }

    // Reset width so layout can reflow naturally
    element.style.removeProperty("max-width");
    const range = document.createRange();
    range.selectNodeContents(element);
    const rects = range.getClientRects();

    // inner elements may have their own rects, so we need to merge adjacent rects
    // to collapse each line into a single rect
    const mergedRects: DOMRect[] = [];
    for (const rect of rects) {
        const last = mergedRects[mergedRects.length - 1];
        if (last && mergeAdjacent(last, rect)) {
            continue;
        }
        mergedRects.push(rect);
    }

    const allSameLine = mergedRects.length <= 1;
    if (allSameLine) {
        // No need to limit width if all text is on the same line
        element.style.removeProperty("max-width");
        return;
    }

    let maxWidth = 0;
    for (const rect of mergedRects) {
        maxWidth = Math.max(maxWidth, rect.width);
    }

    element.style.maxWidth = `${Math.ceil(maxWidth) + 1}px`;
}
function mergeAdjacent(left: DOMRect, right: DOMRect): boolean {
    const threshold = 1; // pixels

    const xAligned = Math.abs(left.x + left.width - right.x) < threshold;
    if (xAligned) {
        left.width = right.x + right.width - left.x;
        return true;
    }

    // ignore if right is on the next line
    if (left.x - 1 > right.x) return false;

    const containsY = (r: DOMRect, y: number) => r.y <= y && y <= r.y + r.height;
    const yOverlaps =
        containsY(left, right.y + right.height / 2) || containsY(right, left.y + left.height / 2);
    if (yOverlaps) {
        left.width = Math.max(left.width, right.x + right.width - left.x);
        return true;
    }

    return false;
}
