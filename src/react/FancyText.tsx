import type { ReactNode } from "react";

export interface FancyTextProps {
    text: string;
}
/**
 * Emits the given text as is, but applies certain simple styles to it.
 *
 * E.g. it will transform a^b to `a<sup>b</sup>`.
 */
export function FancyText({ text }: FancyTextProps) {
    const elements: ReactNode[] = [];

    const re = /\b\^([\da-z]+|\([^()\r\n]+\))/gi;
    let lastEnd = 0;
    while (lastEnd < text.length) {
        const match = re.exec(text);
        if (!match) {
            elements.push(text.substring(lastEnd));
            break;
        }

        if (match.index > lastEnd) {
            elements.push(text.substring(lastEnd, match.index));
        }
        let supContent = match[1];
        if (supContent.startsWith("(") && supContent.endsWith(")")) {
            supContent = supContent.substring(1, supContent.length - 1);
        }
        elements.push(<sup key={elements.length}>{supContent}</sup>);
        lastEnd = match.index + match[0].length;
    }

    return <>{elements}</>;
}
