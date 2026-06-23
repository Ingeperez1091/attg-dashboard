import { ReactNode } from "react";
import { headers } from "next/headers";
import './global.css';
import { NavBar } from './components/NavBar';
import { ThemeToggle } from "./components/ThemeToggle";
import { LogoutButtonWrapper } from "./components/LogoutButtonWrapper";
import { SessionProvider } from "./providers/SessionProvider";
import { AuthenticatedLayout } from "./providers/AuthenticatedLayout";

// SECURITY: This constant MUST remain hardcoded with no dynamic content.
// Any variable interpolation here creates a stored XSS vulnerability.
// See SECURITY_AUDIT_OWASP.md A08 for context.
const THEME_INIT_SCRIPT = `(function(){try{var k='attg-theme';var t=sessionStorage.getItem(k)||localStorage.getItem(k);if(t!=='light'&&t!=='dark'){t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';}document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`;

export const metadata = {
  title: 'ATTG Analytics Dashboard',
  description: 'US Tax Analytics & Business Transformation Dashboard',
};

export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const headersList = await headers();
  const nonce = headersList.get("x-csp-nonce") ?? "";

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script nonce={nonce} suppressHydrationWarning dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="page-layout">
        <SessionProvider>
          <header className="app-header">
            <a href="/" className="app-header__title">
              ATTG Analytics Dashboard {' '}
              <span className="app-header__tagline"> US Tax BTS </span>
            </a>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <LogoutButtonWrapper isDev={false} />
              <ThemeToggle />
            </div>
          </header>
          <NavBar
            canAccessHome={true}
            canAccessFilters={true}
            canAccessUserAdmin={true}
          />
          <AuthenticatedLayout>
            {children}
          </AuthenticatedLayout>
        </SessionProvider>
      </body>
    </html>
  );
}
