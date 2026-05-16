import { useEffect, useState } from "react";

export function useMatchesMedia(query: string, initial = false): boolean {
    const [matches, setMatches] = useState(initial);

    useEffect(() => {
        const mql = window.matchMedia(query);
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setMatches(mql.matches);

        const listener = (event: MediaQueryListEvent) => {
            setMatches(event.matches);
        };

        mql.addEventListener("change", listener);
        return () => {
            mql.removeEventListener("change", listener);
        };
    }, [query]);

    return matches;
}
