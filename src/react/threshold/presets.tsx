import type { Kernel } from "./kernel";

export const PRESETS: Readonly<{
    icon: React.ReactElement;
    title: string;
    kernel: Kernel;
}>[] = [
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Slightly curved line"
            >
                <path d="M 0,11 Q 10,11 16,9" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Slightly curved line",
        kernel: { v00: 0.0, v10: 0.33, v01: 0.72, v11: 0.59, t: 0.5 },
    },
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Horizontal Gradient"
            >
                <line x1="0" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Horizontal Gradient",
        kernel: { v00: 0, v10: 0, v01: 1, v11: 1, t: 0.5 },
    },
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Vertical Gradient"
            >
                <line x1="8" y1="0" x2="8" y2="16" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Vertical Gradient",
        kernel: { v00: 0, v10: 1, v01: 0, v11: 1, t: 0.5 },
    },
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Diagonal Gradient"
            >
                <line x1="0" y1="16" x2="16" y2="0" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Diagonal Gradient",
        kernel: { v00: 0, v10: 0.5, v01: 0.5, v11: 1, t: 0.5 },
    },
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Cross"
            >
                <line x1="8" y1="0" x2="8" y2="16" stroke="currentColor" strokeWidth="2" />
                <line x1="0" y1="8" x2="16" y2="8" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Cross",
        kernel: { v00: 0, v10: 1, v01: 1, v11: 0, t: 0.5 },
    },
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Curves"
            >
                <path d="M 7,0 Q 7,8 0,8" stroke="currentColor" strokeWidth="2" />
                <path d="M 9,16 Q 9,8 16,8" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Curves",
        kernel: { v00: 0, v10: 1, v01: 1, v11: 0, t: 0.49 },
    },
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Curve"
            >
                <path d="M 12,0 Q 10,10 0,12" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Curve",
        kernel: { v00: 0.91, v10: 0.3, v01: 0.3, v11: 0.5, t: 0.5 },
    },
    {
        icon: (
            <svg
                viewBox="0 0 16 16"
                width="16"
                height="16"
                xmlns="http://www.w3.org/2000/svg"
                className="inline-block"
                role="img"
                aria-label="Translated almost cross"
            >
                <path d="M 0,5 C 5,5 5,5 5,16" stroke="currentColor" strokeWidth="2" />
                <path d="M 5,0 C 5,5 5,5 16,5" stroke="currentColor" strokeWidth="2" />
            </svg>
        ),
        title: "Translated almost cross",
        kernel: { v00: 0.63, v10: 1, v01: 1, v11: 0, t: 0.73 },
    },
];
