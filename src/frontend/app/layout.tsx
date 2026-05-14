import { ReactNode } from "react";
import './global.css';
import { NavBar } from './components/NavBar';
import { ThemeToggle } from "./components/ThemeToggle";
import { LogoutButtonWrapper } from "./components/LogoutButtonWrapper";
import { cookies } from "next/headers";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import Link from "next/link";
import { getOptionalSession } from "@/lib/auth/session";
import { createServerRequest } from "@/lib/auth/server-request";
import Script from "next/script";

const THEME_INIT_SCRIPT = `(function(){try{var k='attg-theme';var t=sessionStorage.getItem(k)||localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export const metadata = {
  title: 'ATTG Analytics Dashboard',
  description: 'US Tax Analytics & Business Transformation Dashboard',
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const cookieStore = await cookies();
  const devBypassUserId = process.env.NODE_ENV !== "production" ? cookieStore.get("dev_user_id")?.value : undefined;
  const repositories = getRuntimeRepositories();
  const session = await getOptionalSession(await createServerRequest(), repositories);
  const role = session?.isActive ? session.role : null;

  const canAccessHomeNav = role === "administrator";
  const canAccessFiltersNav = role === "administrator" || role === "application_owner";
  const canAccessUserAdminNav = role === "administrator";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive" dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="page-layout">
        <header className="app-header">
          <Link href="/" className="app-header__title">
            ATTG Analytics Dashboard
            <span className="app-header__tagline">US Tax BTS</span>
          </Link>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            {devBypassUserId ? (
              <LogoutButtonWrapper isDev={true} />
            ) : session?.isActive ? (
              <LogoutButtonWrapper isDev={false} />
            ) : null}
            <ThemeToggle />
          </div>
        </header>
        <NavBar
          canAccessHome={canAccessHomeNav}
          canAccessFilters={canAccessFiltersNav}
          canAccessUserAdmin={canAccessUserAdminNav}
        />
        {children}
      </body>
    </html>
  );
}
