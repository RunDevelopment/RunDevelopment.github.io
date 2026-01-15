import React from "react";
import { Metadata } from "next";
import BasicPage from "../../../components/BasicPage";
import { ConversionConstantsSearch } from "./ConversionConstantsSearch";
import { Markdown } from "../../../components/md/Markdown";
import { BaseArticle } from "../../../components/md/BaseArticle";

export const metadata: Metadata = {
    title: "Multiply-Add Constants Finder by RunDev",
    description: "A tool to find multiply-add constants for a given set of numbers.",
    authors: {
        name: "Michael Schmidt",
    },
    openGraph: {
        type: "website",
    },
};

const SECTION1 = `
# Multiply-Add Constants Finder

The multiply-add method speeds up integer division by a known constant divisor by replacing it with a multiplication, addition, and shift. This tool implements a generalization of this method, which allows multiplication by a known constant rational number (i.e. a fraction) followed by a rounding function. E.g. $\\lceil x \\cdot 3/7 \\rceil$.

### Tool
`;

const SECTION2 = `
### Usage

This tool takes a *problem* (i.e. find multiply-add constants for $\\lceil x \\cdot 3/7 \\rceil$ for $x$ in the range $[0, 255]$) and finds suitable constants.

Specify the parameters below and let this tool find suitable constants.

- \`r\` is the rounding function. After multiplying by the fraction, the result is rarely an integer, so it needs to be rounded. Supported rounding functions are:
    - \`round\`: round to nearest integer, rounding half away from zero
    - \`floor\`: round down to negative infinity, $\\lfloor \\cdot \\rfloor$
    - \`ceil\`: round up to positive infinity, $\\lceil \\cdot \\rceil$

- \`t\` and \`d\` are the numerator and denominator of the fraction to multiply by.

- \`u\` is the maximum input value (inclusive). Found constants are only valid for inputs $x\\in[0,u]$.

   Use the "u*N*" buttons to quickly set the $u$ value for *N*-bit unsigned integers.

The tool will output an expression of the *Best Solution*. There are always infinitely many solutions, but this solution may allow additional compilers optimizations. C and Rust code implementing this solution are generated (some of the integer types used may require third-party libraries).

All solutions for the current problem can be viewed below. Solutions are given by their **s**hift amount, **f**actor, and **a**ddend.

### Limitations

1. Certain problems are very computationally expensive to solve. In that case, this tool falls back to a solution that is known to be correct, but not necessarily optimal (=having the smallest **s**). This is indicated by a warning message.

2. While this tool support arbitrarily large integers as input, your browser may not like that. Number inputs may behave weirdly for numbers greater 4.5e+15 (2^52).
`;

export default function Page() {
    return (
        <BasicPage selectedLink="projects">
            <div className="narrow-container py-8">
                <BaseArticle>
                    <Markdown markdown={SECTION1} />
                </BaseArticle>
                <ConversionConstantsSearch />
                <BaseArticle>
                    <Markdown markdown={SECTION2} />
                </BaseArticle>
            </div>
        </BasicPage>
    );
}
