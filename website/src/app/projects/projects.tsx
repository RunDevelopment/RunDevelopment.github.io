export interface ProjectInfo {
    title: string;
    description: string;
    date: string;
    url: string;
}

export const projects: readonly ProjectInfo[] = [
    {
        title: "Regex Crossword",
        description: "A crossword puzzle that uses regular expressions.",
        date: "2024-09-01",
        url: "/projects/regex-crossword",
    },
    {
        title: "Multiply-Add Constants Finder",
        description:
            "Find constants to perform a fast computation for an equation $R(x \\cdot T / D)$ for arbitrary $T,D \\in \\N$ and rounding function $R$.",
        date: "2024-09-12",
        url: "/projects/multiply-add-constants-finder",
    },
];

export const projectsByYear = projects.reduce<[number, ProjectInfo[]][]>((acc, project) => {
    const year = Number(project.date.split("-")[0]);
    const last = acc.at(-1);
    if (last && last[0] === year) {
        last[1].push(project);
    } else {
        acc.push([year, [project]]);
    }
    return acc;
}, []);
