export interface Kernel {
    readonly v00: number;
    readonly v10: number;
    readonly v01: number;
    readonly v11: number;
    readonly t: number;
}

export function kernelRot90(kernel: Kernel): Kernel {
    return {
        v00: kernel.v01,
        v10: kernel.v00,
        v01: kernel.v11,
        v11: kernel.v10,
        t: kernel.t,
    };
}
/** Approximate the area of the kernel above the threshold by taking N*N samples in a regular grid. */
export function kernelAreaPointSampling(kernel: Kernel, n: number): number {
    let count = 0;

    const { v00, v10, v01, v11, t } = kernel;
    const a = v11 - v10 - v01 + v00;
    const b = v10 - v00;
    const c = v01 - v00;
    const d = v00;

    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
            const u = (i + 0.5) / n;
            const v = (j + 0.5) / n;
            const value = a * u * v + b * u + c * v + d;
            if (value >= t) {
                count++;
            }
        }
    }

    return count / (n * n);
}
/** Approximate the area of the kernel above the threshold by integrating N horizontal lines. */
export function kernelAreaLineSampling(kernel: Kernel, n: number): number {
    let totalArea = 0;

    const { v00, v10, v01, v11, t } = kernel;
    const a = v11 - v10 - v01 + v00;
    const b = v10 - v00;
    const c = v01 - v00;
    const d = v00;

    // v(x,y) = axy + bx + cy + d
    // => x = (t - cy - d) / (ay + b)

    const EPSILON = 1e-6;
    for (let i = 0; i < n; i++) {
        const y = (i + 0.5) / n;
        const dx = a * y + b;
        if (Math.abs(dx) < EPSILON) {
            const atX0 = c * y + d;
            if (atX0 >= t) {
                totalArea += 1;
            }
            continue;
        }
        const rawX = (t - c * y - d) / dx;
        const x = Math.max(0, Math.min(1, rawX));
        let area = x;
        if (dx > 0) area = 1 - area;
        totalArea += area;
    }

    return totalArea / n;
}
/** Uses CPD heuristic to rotate the kernel optimally for horizontal line sampling. */
export function rotateForHorizontalLineSampling(kernel: Kernel): Kernel {
    return shouldRotateHeuristicCPD(kernel) ? kernelRot90(kernel) : kernel;
}
/** Uses CPD heuristic to determine whether to rotate the kernel for horizontal line sampling. */
export function shouldRotateHeuristicCPD(kernel: Kernel): boolean {
    const dx = kernel.v10 + kernel.v11 - (kernel.v00 + kernel.v01);
    const dy = kernel.v01 + kernel.v11 - (kernel.v00 + kernel.v10);
    // console.log("dx:", dx, "dy:", dy);
    return Math.abs(dy) > Math.abs(dx);
}
