export function BaseArticle({ children }: { children: React.ReactNode }) {
    return (
        <article className="narrow-container xs:text-[16px] relative z-[1] text-pretty break-normal text-[15px] leading-relaxed print:text-[14px] print:leading-snug print:text-black">
            {children}
        </article>
    );
}
