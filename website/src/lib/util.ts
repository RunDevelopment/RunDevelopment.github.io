// eslint-disable-next-line no-unused-vars
export function timedCached<F extends (...args: any[]) => any>(ttl: number, fn: F): F {
    const cache = new Map<string, { value: ReturnType<F>; expiry: number }>();

    return ((...args) => {
        const key = JSON.stringify(args);
        const cached = cache.get(key);
        if (cached && cached.expiry > Date.now()) {
            return cached.value;
        }
        const value = fn(...args);
        cache.set(key, { value, expiry: Date.now() + ttl });
        return value;
    }) as F;
}

export function lazy<T extends NonNullable<unknown> | null>(fn: () => T): () => T {
    let value: T | undefined = undefined;

    return () => {
        if (value === undefined) {
            value = fn();
        }
        return value;
    };
}
