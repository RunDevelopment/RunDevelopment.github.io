import { lazyCall } from "../util";
import {
    bruteForceAllSolutions,
    Conversion,
    ConversionRange,
    Request,
} from "./multiply-add-constants";

interface Options {
    optimizeAdd?: boolean;
    fullShifts?: number;
}

interface BruteForceResult {
    conversion: Conversion | undefined;
    solutions: ConversionRange[];
}

async function bruteForceSolution(
    request: Request,
    options: Options,
    signal?: AbortSignal,
): Promise<BruteForceResult> {
    const pickAny = (range: ConversionRange): Conversion => {
        const { factor, shift } = range;
        const [addMin, addMax] = range.add;

        if (addMin === 0) {
            // 0 is the optimal add value, because it's free
            return { factor, add: 0, shift };
        }
        if (addMin === 1) {
            // +1 has a very cheap hardware implementation
            return { factor, add: 1, shift };
        }
        if (addMin <= factor && factor <= addMax) {
            // the compiler can optimize f*x+f to f*(x+1)
            return { factor, add: factor, shift };
        }
        if (addMax === 2 ** shift - 1) {
            return { factor, add: addMax, shift };
        }
        return { factor, add: addMin, shift };
    };

    const globalScope: Record<string, unknown> =
        typeof globalThis !== "undefined" ? globalThis : window;
    const bruteForceAll =
        "bruteForceAllSolutions" in globalScope
            ? (globalScope["bruteForceAllSolutions"] as typeof bruteForceAllSolutions)
            : bruteForceAllSolutions;

    if (options.fullShifts) {
        let conversion: Conversion | undefined;
        const solutions: ConversionRange[] = [];
        for await (const solution of bruteForceAll(
            request,
            { maxShiftAfterFirstSolution: options.fullShifts },
            signal,
        )) {
            conversion ??= pickAny(solution);
            solutions.push(solution);
        }
        return { conversion, solutions };
    }

    if (!options.optimizeAdd) {
        // any solution will do
        for await (const solution of bruteForceAll(request, {}, signal)) {
            return { conversion: pickAny(solution), solutions: [solution] };
        }
        return { conversion: undefined, solutions: [] };
    }

    let any: Conversion | undefined;
    let factorAdd: Conversion | undefined;
    const solutions: ConversionRange[] = [];
    for await (const solution of bruteForceAll(
        request,
        { maxShiftAfterFirstSolution: 6 },
        signal,
    )) {
        solutions.push(solution);
        any ??= pickAny(solution);
        if (solution.add[0] === 0) {
            return { conversion: pickAny(solution), solutions };
        }
        if (factorAdd === null) {
            if (solution.add[0] <= solution.factor && solution.factor <= solution.add[1]) {
                factorAdd = {
                    factor: solution.factor,
                    add: solution.factor,
                    shift: solution.shift,
                };
            }
        }
    }

    return { conversion: factorAdd ?? any, solutions };
}

function webWorkerBruteForce() {
    let lastAbort: AbortController | null = null;
    let lastPromise: Promise<unknown> = Promise.resolve();
    const onmessage = (e: MessageEvent) => {
        const { id, request, requirements } = e.data;
        const process = async () => {
            try {
                lastAbort?.abort("Took too long");
                await lastPromise;
                const abort = new AbortController();
                lastAbort = abort;

                const start = Date.now();
                const promise = bruteForceSolution(request, requirements, abort.signal);
                lastPromise = promise.catch(() => {});
                const result = await promise;
                const time = Date.now() - start;
                postMessage({ id, ...result, request, time });
            } catch (e) {
                postMessage({ id, error: String(e) });
            }
        };
        process().catch(console.error);
    };

    const sourceCode =
        bruteForceAllSolutions.toString() +
        bruteForceSolution.toString() +
        "\nlet lastAbort = null;" +
        "\nlet lastPromise = Promise.resolve();" +
        "\nonmessage = " +
        onmessage.toString();
    const worker = new Worker(
        URL.createObjectURL(new Blob([sourceCode], { type: "application/javascript" })),
    );

    let idCounter = 0;
    const listeners = new Map<number, (result: unknown) => void>();

    worker.onmessage = (e) => {
        const { id } = e.data;
        const listener = listeners.get(id);
        if (listener) {
            listener(e.data);
            listeners.delete(id);
        }
    };

    return (request: Request, requirements: Options) => {
        const id = idCounter++;
        worker.postMessage({ id, request, requirements });
        return new Promise<SearchResult>((resolve, reject) => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            listeners.set(id, (result: any) => {
                if (result.error) {
                    reject(new Error(result.error));
                } else {
                    resolve({
                        conversion: result.conversion,
                        solutions: result.solutions,
                        time: result.time,
                        request: request,
                    });
                }
            });
        });
    };
}

export interface SearchResult {
    conversion: Conversion | undefined;
    solutions: ConversionRange[];
    request: Request;
    time: number;
}

export async function findConversion(
    request: Request,
    options: Options = {},
): Promise<SearchResult> {
    if (typeof Worker !== "undefined") {
        return lazyCall(webWorkerBruteForce)(request, options);
    }
    const start = Date.now();
    const result = await bruteForceSolution(request, options);
    const time = Date.now() - start;
    return { ...result, time, request };
}
