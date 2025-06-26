export interface InfoBoxProps {
    title: string;
    children: React.ReactNode;
}

export function InfoBox({ title, children }: InfoBoxProps) {
    return (
        <div className="narrow relative !-mx-4 my-6 bg-gray-800 py-px pl-6 pr-4 sm:!mx-auto sm:pl-8 print:my-4">
            <span className="absolute left-0 top-0 inline-block h-[4px] w-48 rounded-br-[100%] bg-slate-700" />
            <span className="absolute left-0 top-0 hidden h-[calc(min(10rem,100%))] w-[4px] rounded-br-[100%] bg-slate-700 sm:inline-block" />
            <span className="absolute bottom-0 right-0 inline-block h-[4px] w-48 rounded-tl-[100%] bg-slate-700" />
            <span className="absolute bottom-0 right-0 hidden h-[calc(min(10rem,100%))] w-[4px] rounded-tl-[100%] bg-slate-700 sm:inline-block" />

            <div className="mt-4 [text-box-trim:trim-end]">
                <strong className="font-header font-bold">{title}</strong>
            </div>
            <div className="compact relative z-10 mb-4 mt-3 text-[95%] leading-normal">
                {children}
            </div>
        </div>
    );
}
