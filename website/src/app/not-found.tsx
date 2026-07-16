import type { Metadata } from "next";
import PageSettings from "../components/PageSettings";
import { TextLink } from "../components/md/TextLink";
import Link from "next/link";
import Particles from "../components/Particles";
import { ClientOnly } from "../components/util-client";

export const metadata: Metadata = {
    title: "404: Page Not Found - RunDev",
    description: "The page you requested could not be found.",
    robots: "noindex, nofollow",
    authors: {
        name: "Michael Schmidt",
    },
};

export default async function PageNotFound() {
    return (
        <>
            <PageSettings pageBg="black" fancyHeader />
            <main className="box-content flex h-[calc(90vh-var(--header-height))] min-h-[350px] items-center justify-center px-4 md:pt-[var(--header-height)]">
                <style>{`#not-found-text { text-shadow: 0 0 20px black, 0 0 20px black, 0 0 20px black, 0 0 20px black, 0 0 20px black; }`}</style>
                <div className="text-center xs:text-lg" id="not-found-text">
                    <p className="text-[10rem] leading-none text-white">404</p>
                    <p className="mb-10 text-4xl text-white">Page Not Found</p>
                    <p>Oh no! This page doesn&apos;t exist anymore.</p>
                    <p>
                        Or was it never there to begin with
                        <Link href="https://youtu.be/bd2nWh6wui0?si=2tSVuDd_fvQSrH_y&t=418">?</Link>
                    </p>
                    <p className="mt-6 pb-6 font-bold">
                        <TextLink href="/">Home</TextLink>
                    </p>
                </div>
                <ClientOnly>
                    <style>{`
                    @keyframes fadeInOpacity {
                        0% {
                            opacity: 0;
                        }
                        100% {
                            opacity: 1;
                        }
                    }

                    #particles-container {
                        opacity: 1;
                        animation-name: fadeInOpacity;
                        animation-iteration-count: 1;
                        animation-timing-function: ease-in;
                        animation-duration: 5s;
                    }
                    `}</style>
                    <div
                        id="particles-container"
                        className="pointer-events-none absolute inset-0 -z-10 select-none overflow-hidden"
                    >
                        <Particles />
                    </div>
                </ClientOnly>
            </main>
        </>
    );
}
