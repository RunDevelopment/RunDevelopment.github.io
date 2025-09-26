import { Montserrat, Source_Code_Pro, Source_Serif_4, Roboto } from "next/font/google";

export const sans = Roboto({
    weight: ["400", "700"],
    subsets: ["latin"],
    adjustFontFallback: false,
    fallback: ["Roboto", "Segoe UI", "Arial", "sans-serif"],
    variable: "--font-sans",
});
export const serif = Source_Serif_4({
    weight: ["400", "700"],
    style: ["normal", "italic"],
    subsets: ["latin"],
    adjustFontFallback: false,
    fallback: ["Source Serif", "Georgia", "Times New Roman", "serif"],
    variable: "--font-serif",
});
export const header = Montserrat({
    weight: ["300", "400", "500", "700"],
    style: ["normal", "italic"],
    subsets: ["latin"],
    adjustFontFallback: false,
    fallback: ["Montserrat", "Open Sans", "sans-serif"],
    variable: "--font-header",
});
export const mono = Source_Code_Pro({
    weight: "400",
    style: "normal",
    subsets: ["latin"],
    adjustFontFallback: false,
    fallback: ["Source Code Pro", "monospace"],
    variable: "--font-mono",
});

export const allFonts =
    sans.variable + " " + serif.variable + " " + header.variable + " " + mono.variable;
