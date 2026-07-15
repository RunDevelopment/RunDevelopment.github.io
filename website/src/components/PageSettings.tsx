import type { HeaderLink } from "./Header";

export default function PageSettings({
    fancyHeader = false,
    selectedLink,
    pageBg,
    noHeader = false,
}: {
    fancyHeader?: boolean;
    selectedLink?: HeaderLink;
    pageBg?: string;
    noHeader?: boolean;
}) {
    const rules: string[] = [];

    if (pageBg) {
        rules.push(`:root { --page-bg: ${pageBg}; }`);
    }
    if (noHeader) {
        rules.push(`header { display: none !important; }`);
    }

    return (
        <div
            id="page-settings"
            data-header-type={fancyHeader ? "fancy" : "basic"}
            data-header-selected={selectedLink}
            aria-hidden="true"
            className="hidden"
        >
            <style>{rules.join("\n")}</style>
        </div>
    );
}
