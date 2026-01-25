function roundDiv1023(v: number): number {
    let x = v + 512;
    return ((x >> 10) + x) >> 10;
}
function roundDiv2pnM1(v: number, n: number): number {
    let x = v + (1 << (n - 1));
    return ((x >> n) + x) >> n;
}
function roundDiv2pnM1Iters(v: number, n: number, iters: number): number {
    let x = v + (1 << (n - 1));
    let r = x >> n;
    while (iters-- > 1) {
        r = (r + x) >> n;
    }
    return r;
}
function ceilDiv2pnM1Iters(v: number, n: number, iters: number): number {
    let x = v + (1 << n) - 1;
    let r = x >> n;
    while (iters-- > 1) {
        r = (r + x) >> n;
    }
    return r;
}
function floorDiv2pnM1Iters(v: number, n: number, iters: number): number {
    let x = v + 1;
    let r = x >> n;
    while (iters-- > 1) {
        r = (r + x) >> n;
    }
    return r;
}


function roundDiv2pnP1Iters(v: number, n: number, iters: number): number {
    let x = v + (1 << (n - 1)) - iters % 2;
    let r = x >> n;
    while (iters-- > 1) {
        r = (x - r) >> n;
    }
    return r;
}
function ceilDiv2pnP1Iters(v: number, n: number, iters: number): number {
    let x = v + (1 << n) - iters % 2;
    let r = x >> n;
    while (iters-- > 1) {
        r = (x - r) >> n;
    }
    return r;
}
function floorDiv2pnP1Iters(v: number, n: number, iters: number): number {
    let x = v - iters % 2;
    let r = x >> n;
    while (iters-- > 1) {
        r = (x - r) >> n;
    }
    return r;
}

function roundDiv(a: number, b: number): number {
    return Math.round(a / b);
}
function ceilDiv(a: number, b: number): number {
    return Math.ceil(a / b);
}
function floorDiv(a: number, b: number): number {
    return Math.floor(a / b);
}

function findDiff(f: (v: number) => number, ref: (v: number) => number, maxDiffs = 20) {
    for (let i = 0; i < 1e9 && maxDiffs > 0; i++) {
        const r1 = f(i);
        const r2 = ref(i);
        if (r1 !== r2) {
            console.log(`input ${i}: f=${r1} vs ref=${r2}\tδ=${r1 - r2}`);
            maxDiffs--;
        }
    }
}

interface TableOptions {
    maxN?: number;
    maxIters?: number;
    maxV?: number;
    minV?: number;
    quickSearch?: boolean;
    cellWidth?: number;
}
function printSmallestIncorrectTable(
    f: (v: number, n: number, iters: number) => number,
    ref: (v: number, n: number) => number,
    { maxN = 8, maxIters = 5, maxV = 1e7, minV = 0, quickSearch = true, cellWidth = 8 }: TableOptions = {}
) {
    const printCells = (cells: (string | number)[]) => {
        let s = "| " + cells[0].toString().padStart(3) + " | ";
        for (const cell of cells.slice(1)) {
            s += cell.toString().padEnd(cellWidth) + " | ";
        }
        console.log(s);
    }
    printCells(["n", ...Array.from({ length: maxIters }, (_, i) => `iters=${i + 1}`)]);
    printCells(["--:", ...Array.from({ length: maxIters }, (_) => "---")]);

    for (let n = 1; n <= maxN; n++) {
        const cells: (string | number)[] = [n];
        for (let iters = 1; iters <= maxIters; iters++) {
            const base = 2 ** (n * iters);

            let smallestIncorrect = null;

            const start = quickSearch ? Math.max(minV, base - 1234) : minV;
            const max = Math.min(start + maxV, 2 ** 31);
            for (let v = start; v < max; v++) {
                const r1 = f(v, n, iters);
                const r2 = ref(v, n);
                if (r1 !== r2) {
                    smallestIncorrect = v;
                    break;
                }
            }

            if (smallestIncorrect === null) {
                cells.push("-");
            } else {
                const diff = smallestIncorrect - base;
                cells.push(`2^${n * iters}${diff >= 0 ? "+" : ""}${diff}`);
            }

        }
        printCells(cells);
    }
}
function printSmallestIncorrectTableFor(mode: "round" | "ceil" | "floor", options: TableOptions = {}) {
    console.log(`Table for ${mode} division:`);

    const [f, ref] = {
        "round": [roundDiv2pnM1Iters, roundDiv] as const,
        "ceil": [ceilDiv2pnM1Iters, ceilDiv] as const,
        "floor": [floorDiv2pnM1Iters, floorDiv] as const,
    }[mode];

    printSmallestIncorrectTable(
        f,
        (v, n) => ref(v, (2 ** n) - 1),
        options
    );
}
function printSmallestIncorrectTableForAll(options: TableOptions = {}) {
    printSmallestIncorrectTableFor("round", options);
    console.log("");
    printSmallestIncorrectTableFor("ceil", options);
    console.log("");
    printSmallestIncorrectTableFor("floor", options);
}
// printSmallestIncorrectTableForAll({ maxN: 8, maxIters: 5, quickSearch: true });

printSmallestIncorrectTable(
    floorDiv2pnP1Iters,
    (v, n) => floorDiv(v, (1 << n) + 1),
    { maxN: 8, maxIters: 8, quickSearch: false, maxV: 1e9, minV: 1 }
)
// const n = 4;
// findDiff(
//     (v) => roundDiv2pnP1Iters(v, n, 6),
//     (v) => roundDiv(v, (1 << n) + 1),
//     1,
// );

// for (let n = 1; n <= 5; n++) {
//     console.log(`n=${n}`);
//     findDiff(
//         (v) => floorDiv2pnM1Iters(v, n, 5),
//         (v) => floorDiv(v, (1 << n) - 1),
//         1,
//     );
// }

// Rounded division
// const N = 4;
// const ITERS = 2;
// findDiff(
//     (v) => roundDiv2pnM1Iters(v, N, ITERS),
//     (v) => roundDiv(v, (1 << N) - 1),
//     100
// );

// Ceil division
// const N = 2;
// const ITERS = 3;
// findDiff(
//     (v) => ceilDiv2pnM1Iters(v, N, ITERS),
//     (v) => ceilDiv(v, (1 << N) - 1),
// );

// Floor division
// const N = 4;
// const ITERS = 2;
// findDiff(
//     (v) => floorDiv2pnM1Iters(v, N, ITERS),
//     (v) => floorDiv(v, (1 << N) - 1),
// );


// function analyseDeltas(n: number, iters: number = 2, maxOutput: number = 20) {
//     const f = (v: number) => roundDiv2pnM1Iters(v, n, iters);
//     const ref = (v: number) => roundDiv(v, (1 << n) - 1);
//     const pow = 1 << n;

//     for (let a = 0; a < maxOutput; a++) {
//         const j_i = a >> (iters * n);
//         const k_i = a % (1 << (iters * n));
//         const start = a * (pow - 1) + (pow >> 1);
//         const end = (a - 1) * (pow - 1) + (pow >> 1);
//         let deltaMin = Infinity;
//         let deltaMax = -Infinity;
//         for (let v = start; v >= end; v--) {
//             const r1 = f(v);
//             const r2 = ref(v);
//             const delta = r1 - r2;
//             if (delta < deltaMin) {
//                 deltaMin = delta;
//             }
//             if (delta > deltaMax) {
//                 deltaMax = delta;
//             }
//         }
//         const range = deltaMin === deltaMax ? `${deltaMin}` : `${deltaMin}, ${deltaMax}`;
//         console.log(`| ${a} | ${j_i} | ${k_i} | $\\set{${range}}$ |`);
//     }
// }
// analyseDeltas(2, 1, 100);
