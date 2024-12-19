import "./globals.css";

export default function Layout({ children }: { children: React.ReactNode }) {
    return <body className="overflow-hidden bg-black">{children}</body>;
}
