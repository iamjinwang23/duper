import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

export default auth((req) => {
  // Every request that reaches here is a protected /admin route (login lives at
  // /login, outside the matcher). Redirect unauthenticated users to sign in.
  if (!req.auth) {
    const url = new URL("/login", req.nextUrl.origin);
    url.searchParams.set("callbackUrl", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
});

export const config = {
  matcher: ["/admin/:path*"],
};
