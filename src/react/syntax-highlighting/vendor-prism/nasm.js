import { Prism } from "./core.js"

Prism.languages.nasm = Prism.languages.asm = {
    comment: {
        pattern: /;.*/g,
        greedy: true,
    },
    string: {
        pattern: /"(?:\\[\s\S]|[^\\"])*"|'(?:\\[\s\S]|[^\\'])*'/g,
        greedy: true,
    },
    keyword: [
        /\[?BITS (?:16|32|64)\]?/,
        {
            pattern: /(^\s*)section\s*[a-z.]+:?/im,
            lookbehind: true,
        },
        /(?:extern|global)[^;\r\n]*/i,
        /(?:CPU|DEFAULT|FLOAT).*$/m,
    ],
    instruction: [
        {
            pattern: /^[ \t]*(?:call|ret|hlt|j[a-z]{1,4}|loop[a-z]{0,2})(?=\s|$)/m,
            greedy: true,
            alias: ["keyword", "control-flow"],
        },
        {
            pattern: /^[ \t]*\.?\w+(?=\s|$)/m,
            greedy: true,
            alias: "keyword",
        }
    ],
    label: {
        pattern: /^[ \t]*\.?\w+(?=:(?!:))|\.[A-Z]\w*\b|(-|\.(?:rodata|text)\.)[a-z]\w*/m,
        lookbehind: true,
        alias: "function",
    },
    register: {
        pattern:
            /%?\b(?:st\d|[xyz]mm\d\d?|[cdt]r\d|r\d\d?[bwd]?|[er]?[abcd]x|[abcd][hl]|[er]?(?:bp|di|si|sp)|[cdefgs]s|[sd]i[lh]|[bs]p[lh])\b/,
        alias: "variable",
    },
    number: /\b\d+\b|\b0x[\da-f]+\b/i,
    punctuation: /[[\]:,+]/,
};
