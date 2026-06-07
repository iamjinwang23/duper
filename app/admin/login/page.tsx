import { signIn } from "@/lib/auth";

export default function AdminLoginPage(props: {
  searchParams: { callbackUrl?: string };
}) {
  const callbackUrl = props.searchParams.callbackUrl ?? "/admin";
  return (
    <main className="min-h-screen flex items-center justify-center bg-neutral-950 text-neutral-100">
      <div className="w-full max-w-sm rounded-xl border border-neutral-800 p-8 text-center">
        <h1 className="font-serif text-2xl mb-2">DUPE Admin</h1>
        <p className="text-sm opacity-60 mb-6">Sign in with Google</p>
        <form
          action={async () => {
            "use server";
            await signIn("google", { redirectTo: callbackUrl });
          }}
        >
          <button
            type="submit"
            className="w-full rounded-md bg-white text-neutral-900 py-2 font-medium"
          >
            Continue with Google
          </button>
        </form>
      </div>
    </main>
  );
}
