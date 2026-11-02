import { Riel } from "@/components/Riel";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="app">
      <Riel />
      <main className="contenido">{children}</main>
    </div>
  );
}
