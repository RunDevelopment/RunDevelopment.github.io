export const noop = (): void => {};
export const identity = <T>(x: T): T => x;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

const lazyCache = new WeakMap<() => unknown, () => unknown>();
/**
 * Returns a version of the function that caches the result of the first call.
 *
 * The returned function itself is memoized.
 */
export function lazy<T extends NonNullable<unknown> | null>(fn: () => T): () => T {
    let lazyFn = lazyCache.get(fn) as (() => T) | undefined;

    if (lazyFn === undefined) {
        let value: T | undefined = undefined;
        lazyFn = () => {
            if (value === undefined) {
                value = fn();
            }
            return value;
        };
        lazyCache.set(fn, lazyFn);
    }

    return lazyFn;
}
/**
 * Invokes the given function only once and caches the result. Subsequent calls will return the cached value.
 *
 * This behaves the same as `lazy(fn)()`.
 */
export function lazyCall<T extends NonNullable<unknown> | null>(fn: () => T): T {
    let lazyFn = lazyCache.get(fn) as (() => T) | undefined;
    if (lazyFn) {
        return lazyFn();
    }

    const value = fn();
    lazyFn = () => value;
    lazyCache.set(fn, lazyFn);
    return value;
}

export function cachedWeak<T extends object, R>(fn: (item: T) => R): (item: T) => R {
    const cache = new WeakMap<T, R>();

    return (item) => {
        if (cache.has(item)) {
            return cache.get(item)!;
        }
        const value = fn(item);
        cache.set(item, value);
        return value;
    };
}

export function formatDateString(date: string, year: boolean = true): string {
    const parsedTime = Date.parse(date);
    if (Number.isNaN(parsedTime)) {
        return date;
    }
    const parsed = new Date(parsedTime);

    const monthAndDay = `${parsed.toLocaleString("en-us", { month: "short" })} ${parsed.getUTCDate()}`;
    if (year) {
        return `${monthAndDay}, ${parsed.getUTCFullYear()}`;
    }
    return monthAndDay;
}
