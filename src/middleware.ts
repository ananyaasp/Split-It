import NextAuth from "next-auth";

import { authConfig } from "@/lib/auth.config";

export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/dashboard/:path*", "/groups/:path*", "/profile/:path*", "/join/:path*"],
};
