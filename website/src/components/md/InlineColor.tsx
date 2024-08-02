import { memo } from "react";

const colorPattern = /^(?:#[a-f0-9]{3}|#[a-f0-9]{6}|(?:rgb|hsl|hsv)a?\([ ,0-9%deg]+\))$/i;

export const InlineColor = memo(({ code }: { code: string }) => {
    if (!colorPattern.test(code)) {
        return null;
    }
    return (
        <span
            style={{ backgroundColor: code }}
            className="mb-0.5 mr-1 inline-block size-3 border border-white align-middle"
        ></span>
    );
});
