"use client";

import { logout } from "@/app/actions/auth-actions";
import { ReactElement } from "react";

interface LogoutButtonProps {
  isDev?: boolean;
}

/**
 * Logout button for authenticated users.
 * Clears sessionStorage token before signing out.
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
          onClick={() => {
            try {
              sessionStorage.removeItem("attg_session_token");
              sessionStorage.removeItem("attg_session_user");
            } catch { /* ignore */ }
          }}
        >
          Logout (Dev)
        </button>
      </form>
    );
  }

  const handleLogout = async () => {
    try {
      sessionStorage.removeItem("attg_session_token");
      sessionStorage.removeItem("attg_session_user");
    } catch { /* ignore */ }
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
