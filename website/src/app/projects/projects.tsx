import { IS_DEV } from "../../lib/fs/config";

export interface ProjectInfo {
    title: string;
    description: string;
    date: string;
    url: string;
    hidden?: boolean;
}

const projects: readonly ProjectInfo[] = [
    {
        title: "Multiply-Add Constants Finder",
        description:
            "Find constants to speed up the computation of $r(x \\cdot t / d)$ for arbitrary $t,d \\in \\N_1$ and rounding function $r$.",
        date: "2025-09-24",
        url: "/projects/multiply-add-constants-finder",
    },
    {
        title: "Regex Crossword",
        description: "A crossword puzzle that uses regular expressions.",
        date: "2024-09-01",
        url: "/projects/regex-crossword",
        hidden: true,
    },
    {
        title: "Connect Four",
        description: "Play Connect Four against AI or other players.",
        date: "2024-09-12",
        url: "/projects/connect-4444",
        hidden: true,
    },
];

export const projectsByYear = projects
    .filter((p) => !p.hidden || IS_DEV)
    .map((p) => {
        if (p.hidden) {
            p.title += " [HIDDEN]";
        }
        return p;
    })
    .reduce<[number, ProjectInfo[]][]>((acc, project) => {
        const year = Number(project.date.split("-")[0]);
        const last = acc.at(-1);
        if (last && last[0] === year) {
            last[1].push(project);
        } else {
            acc.push([year, [project]]);
        }
        return acc;
    }, []);
