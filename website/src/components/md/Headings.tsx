import Link from "next/link";
import { memo, ReactNode } from "react";
import { Components, getHeadingId, getTextContent } from "../../lib/md-util";

function HeaderLink({ id, children }: { id: string; children: ReactNode }) {
    return (
        <Link
            href={"#" + id}
            className="relative after:absolute after:pl-[0.6em] after:opacity-0 after:transition-opacity after:content-['#'] hover:after:opacity-75 print:text-black"
        >
            {children}
        </Link>
    );
}

export const H1: Components["h1"] = memo(({ children }) => {
    return (
        <h1 className="font-header mb-10 text-balance text-center text-3xl leading-10 text-white md:mb-12 md:text-4xl md:leading-[3rem] print:text-black">
            {children}
        </h1>
    );
});
export const H2: Components["h2"] = memo(({ children, node }) => {
    const id = getHeadingId(getTextContent(children, node));
    return (
        <h2
            id={id}
            className="font-header font-medium sm:font-normal mb-8 mt-10 overflow-hidden border-b-2 border-b-neutral-500 md:pr-8 pt-8 text-center leading-tight text-[26px] text-white sm:text-4xl print:text-black"
        >
            <HeaderLink id={id}>{children}</HeaderLink>
        </h2>
    );
});
export const H3: Components["h3"] = memo(({ children, node }) => {
    const id = getHeadingId(getTextContent(children, node));
    return (
        <h3
            id={id}
            className="font-header font-medium narrow mb-[1.125rem] mt-12 overflow-hidden border-b-2 border-dashed border-b-neutral-500 text-xl text-white sm:text-[28px] sm:leading-tight print:text-black"
        >
            <HeaderLink id={id}>{children}</HeaderLink>
        </h3>
    );
});
export const H4: Components["h4"] = memo(({ children, node }) => {
    const id = getHeadingId(getTextContent(children, node));
    return (
        <h4
            id={id}
            className="font-header font-medium narrow mb-4 mt-12 overflow-hidden border-b-2 border-dotted border-b-neutral-700 text-lg text-white sm:text-xl print:text-black"
        >
            <HeaderLink id={id}>{children}</HeaderLink>
        </h4>
    );
});
