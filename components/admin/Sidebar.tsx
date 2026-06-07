import Link from "next/link";
import { signOut } from "@/lib/auth";

const NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/products", label: "Products" },
  { href: "/admin/products/new", label: "+ New Product" },
  { href: "/admin/match", label: "매칭" },
];

export function Sidebar({ email }: { email: string }) {
  return (
    <aside className="w-56 shrink-0 border-r border-neutral-800 p-6 flex flex-col gap-1">
      <div className="font-serif text-xl mb-6">DUPE Admin</div>
      <nav className="flex flex-col gap-1">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-md px-3 py-2 text-sm hover:bg-neutral-800"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <div className="mt-auto pt-6 border-t border-neutral-800 text-xs">
        <div className="opacity-60 mb-2 truncate">{email}</div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/" });
          }}
        >
          <button type="submit" className="text-xs opacity-70 hover:opacity-100">
            Sign out
          </button>
        </form>
      </div>
    </aside>
  );
}
