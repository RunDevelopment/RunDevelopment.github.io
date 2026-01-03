"use client";

import React, { memo, useEffect } from "react";

export const OpenDetailsOnPrint = memo(() => {
    useEffect(() => {
        window.addEventListener("beforeprint", openAllDetails);
        return () => {
            window.removeEventListener("beforeprint", openAllDetails);
        };
    }, []);

    return <></>;
});

function openAllDetails() {
    const details = document.querySelectorAll("article details");
    details.forEach((detail) => {
        detail.setAttribute("open", "");
    });
}
