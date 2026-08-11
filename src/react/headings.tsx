export function H2({ children, id }: { children: React.ReactNode; id?: string }) {
    return (
        <h2
            id={id}
            className="mb-6 mt-12 font-heading text-2xl text-white first:mt-0 xs:text-3xl"
            data-wide
        >
            {children}
        </h2>
    );
}
