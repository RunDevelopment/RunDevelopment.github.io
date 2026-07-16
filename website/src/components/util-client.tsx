"use client";

import { useEffect, useState } from "react";

export function ClientOnly({ children }: { children?: React.ReactNode }) {
    const [mounted, setMounted] = useState(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setMounted(true), []);
    if (!mounted) return null;
    return <>{children}</>;
}
