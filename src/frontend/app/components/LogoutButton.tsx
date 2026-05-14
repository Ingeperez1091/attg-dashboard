"use client";

import { logout } from "@/app/actions/auth-actions";
import { ReactElement } from "react";

interface LogoutButtonProps {
  isDev?: boolean;
}

/**
 * Logout button for authenticated users.
 * Signs out via server action and redirects to login page.
 * In dev bypass mode, POST to /api/auth/dev-logout to clear the dev_user_id cookie.
 * In SSO mode, use the NextAuth signOut server action.
 */
export function LogoutButton({ isDev = false }: LogoutButtonProps): ReactElement {
  if (isDev) {
    return (
      <form action="/api/auth/dev-logout" method="post" style={{ display: "inline" }}>
        <input type="hidden" name="returnUrl" value="/login" />
        <button
          type="submit"
          className="btn btn--outline"
          style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
          title="Sign out of dev bypass"
        >
          Logout (Dev)
        </button>
      </form>
    );
  }

  const handleLogout = async () => {
    await logout();
  };

  return (
    <button
      onClick={handleLogout}
      className="btn btn--outline"
      style={{ padding: "0.3rem 0.7rem", fontSize: "0.8rem" }}
      title="Sign out"
    >
      Logout
    </button>
  );
}
