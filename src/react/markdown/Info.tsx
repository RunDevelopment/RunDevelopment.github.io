import "./Info.css";

export interface InfoProps {
    title: React.ReactNode;
    children: React.ReactNode;
}

export function Info({ title, children }: InfoProps) {
    return (
        <div className="Info">
            <span className="h" style={{ top: 0, left: 0, borderBottomRightRadius: "100%" }} />
            <span className="v" style={{ top: "4px", left: 0, borderBottomRightRadius: "100%" }} />
            <span className="h" style={{ bottom: 0, right: 0, borderTopLeftRadius: "100%" }} />
            <span className="v" style={{ bottom: "4px", right: 0, borderTopLeftRadius: "100%" }} />

            <p className="Title">{title}</p>

            {children}
        </div>
    );
}
