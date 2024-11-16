"use client";

import { memo, useEffect, useRef } from "react";

export const TodoMarker = memo(({ children }: React.PropsWithChildren<unknown>) => {
    const ref = useRef<HTMLSpanElement>(null);

    useEffect(() => {
        const marker = document.createElement("span");

        const updateTop = () => {
            const docHeight = document.documentElement.scrollHeight;
            const spanPos =
                document.documentElement.scrollTop +
                (ref.current?.getBoundingClientRect().top ?? 0);
            marker.style.top = (spanPos / docHeight) * 100 + "%";
        };
        updateTop();

        marker.style.position = "fixed";
        marker.style.right = "0";
        marker.style.width = "20px";
        marker.style.height = "8px";
        marker.style.display = "inline-block";
        marker.style.background = "red";
        marker.style.border = "1px solid black";
        marker.style.cursor = "pointer";
        marker.onclick = () => {
            ref.current?.scrollIntoView({ behavior: "smooth", block: "center" });
        };

        const timer = setInterval(updateTop, 200);

        document.body.appendChild(marker);

        return () => {
            marker.remove();
            clearInterval(timer);
        };
    }, []);

    return (
        <>
            <span ref={ref} />
            {children}
        </>
    );
});
