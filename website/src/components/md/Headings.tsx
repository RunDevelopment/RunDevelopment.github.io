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
        <h1 className="mb-10 text-pretty text-center text-3xl leading-10 text-white md:mb-12 md:text-4xl md:leading-[3rem] print:text-black">
            {children}
        </h1>
    );
});
export const H2: Components["h2"] = memo(({ children, node }) => {
    const id = getHeadingId(getTextContent(children, node));
    return (
        <h2
            id={id}
            className="mb-8 mt-10 overflow-hidden border-b-2 border-b-neutral-500 pt-8 text-2xl text-white md:text-3xl print:text-black"
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
            className="mb-4 mt-8 overflow-hidden border-b-2 border-dashed border-b-neutral-500 text-xl text-white md:text-2xl print:text-black"
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
            className="mb-4 mt-6 overflow-hidden border-b-2 border-dotted border-b-neutral-700 text-lg text-white md:text-xl print:text-black"
        >
            <HeaderLink id={id}>{children}</HeaderLink>
        </h4>
    );
});
