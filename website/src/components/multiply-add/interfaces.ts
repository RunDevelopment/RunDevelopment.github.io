export type RoundingMode = "round" | "floor" | "ceil";
export interface ProblemLike {
    readonly inputRange: number;
    readonly rounding: RoundingMode;
    readonly d: number;
    readonly t: number;
}
export interface AddRangeLike {
    readonly min: bigint;
    readonly max: bigint;
}
export interface SolutionRangeLike {
    readonly factor: bigint;
    readonly add: AddRangeLike;
    readonly shift: number;
}
export interface SolutionLike {
    readonly factor: bigint;
    readonly add: bigint;
    readonly shift: number;
}
