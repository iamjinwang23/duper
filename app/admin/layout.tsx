import { auth } from "@/lib/auth";
import { Sidebar } from "@/components/admin/Sidebar";
import { redirect } from "next/navigation";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  if (!session?.user?.email) {
    // middleware should have caught this, but defense in depth
    redirect("/login");
  }
  return (
    <div className="min-h-screen flex bg-neutral-950 text-neutral-100">
      <Sidebar email={session.user.email} />
      <main className="flex-1 p-10">{children}</main>
    </div>
  );
}
