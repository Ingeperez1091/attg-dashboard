"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ReactElement, useEffect, useRef, useState } from "react";

interface NavItem {
  label: string;
  href: string;
  icon: string;
  /** If true, only exact pathname matches activate this link */
  exact?: boolean;
}

interface NavBarProps {
  canAccessHome?: boolean;
  canAccessFilters?: boolean;
  canAccessUserAdmin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "🏠", exact: true },
  { label: "Dashboard", href: "/dashboard", icon: "📊", exact: true }
];

const ADMIN_NAV_ITEM: NavItem = { label: "Users", href: "/admin/users", icon: "👥" };

const FILTER_RULES_ITEMS: NavItem[] = [
  { label: "Numerator Filter", href: "/filters/numerator", icon: "🧩" },
  { label: "Denominator Filter", href: "/filters/denominator", icon: "📐" }
];

/**
 * Primary application navigation bar.
 * Highlights the active route using next/navigation's usePathname.
 * Collapses to a hamburger menu on narrow viewports.
 */
export function NavBar({
  canAccessHome = false,
  canAccessFilters = false,
  canAccessUserAdmin = false
}: NavBarProps): ReactElement | null {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [mobileFilterMenuOpen, setMobileFilterMenuOpen] = useState(false);
  const filterMenuRef = useRef<HTMLLIElement | null>(null);

  useEffect(() => {
    function onDocumentClick(event: MouseEvent): void {
      if (!filterMenuRef.current?.contains(event.target as Node)) {
        setFilterMenuOpen(false);
      }
    }

    function onEscape(event: KeyboardEvent): void {
      if (event.key === "Escape") {
        setFilterMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  useEffect(() => {
    setFilterMenuOpen(false);
    setMobileFilterMenuOpen(false);
  }, [pathname]);

  function isActive(item: NavItem): boolean {
    return item.exact ? pathname === item.href : pathname.startsWith(item.href);
  }

  function isFilterRulesActive(): boolean {
    return pathname.startsWith("/filters");
  }

  const primaryNavItems = canAccessHome ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/");

  if (pathname === "/login") {
    return null;
  }

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-inner">
        {/* Desktop links */}
        <ul className="navbar-links" role="list">
          {primaryNavItems.map((item) => {
            const active = isActive(item);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={`navbar-link${active ? " navbar-link-active" : ""}`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="navbar-link-icon" aria-hidden="true">{item.icon}</span>
                  {item.label}
                </Link>
              </li>
            );
          })}

          {canAccessUserAdmin ? (
            <li>
              <Link
                href={ADMIN_NAV_ITEM.href}
                className={`navbar-link${isActive(ADMIN_NAV_ITEM) ? " navbar-link-active" : ""}`}
                aria-current={isActive(ADMIN_NAV_ITEM) ? "page" : undefined}
              >
                <span className="navbar-link-icon" aria-hidden="true">{ADMIN_NAV_ITEM.icon}</span>
                {ADMIN_NAV_ITEM.label}
              </Link>
            </li>
          ) : null}

          {canAccessFilters ? (
            <li ref={filterMenuRef} className="navbar-dropdown">
              <button
                type="button"
                className={`navbar-link navbar-dropdown-toggle${isFilterRulesActive() ? " navbar-link-active" : ""}`}
                aria-expanded={filterMenuOpen}
                aria-haspopup="menu"
                onClick={() => setFilterMenuOpen((open) => !open)}
              >
                <span className="navbar-link-icon" aria-hidden="true">🧩</span>
                Filter Rules
                <span className="navbar-dropdown-arrow" aria-hidden="true">▾</span>
              </button>

              {filterMenuOpen && (
                <div className="navbar-dropdown-menu" role="menu">
                  {FILTER_RULES_ITEMS.map((item) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        className={`navbar-dropdown-item${active ? " navbar-dropdown-item-active" : ""}`}
                        role="menuitem"
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </li>
          ) : null}
        </ul>

        {/* Mobile hamburger */}
        <button
          type="button"
          className="navbar-hamburger"
          aria-label={menuOpen ? "Close menu" : "Open menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span className="navbar-hamburger-icon">{menuOpen ? "✕" : "☰"}</span>
        </button>
      </div>

      {/* Mobile drop-down */}
      {menuOpen && (
        <div className="navbar-mobile-menu" role="menu">
          {primaryNavItems.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={`navbar-mobile-link${active ? " navbar-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => setMenuOpen(false)}
              >
                <span aria-hidden="true">{item.icon}</span>
                {item.label}
              </Link>
            );
          })}

          {canAccessUserAdmin ? (
            <Link
              href={ADMIN_NAV_ITEM.href}
              role="menuitem"
              className={`navbar-mobile-link${isActive(ADMIN_NAV_ITEM) ? " navbar-link-active" : ""}`}
              aria-current={isActive(ADMIN_NAV_ITEM) ? "page" : undefined}
              onClick={() => setMenuOpen(false)}
            >
              <span aria-hidden="true">{ADMIN_NAV_ITEM.icon}</span>
              {ADMIN_NAV_ITEM.label}
            </Link>
          ) : null}

          {canAccessFilters ? (
            <>
              <button
                type="button"
                role="menuitem"
                className={`navbar-mobile-link navbar-mobile-dropdown-toggle${isFilterRulesActive() ? " navbar-link-active" : ""}`}
                aria-expanded={mobileFilterMenuOpen}
                onClick={() => setMobileFilterMenuOpen((open) => !open)}
              >
                <span aria-hidden="true">🧩</span>
                Filter Rules
                <span className="navbar-mobile-dropdown-arrow" aria-hidden="true">{mobileFilterMenuOpen ? "▴" : "▾"}</span>
              </button>

              {mobileFilterMenuOpen && (
                <div className="navbar-mobile-submenu" role="menu">
                  {FILTER_RULES_ITEMS.map((item) => {
                    const active = isActive(item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        role="menuitem"
                        className={`navbar-mobile-link navbar-mobile-sublink${active ? " navbar-link-active" : ""}`}
                        aria-current={active ? "page" : undefined}
                        onClick={() => {
                          setMobileFilterMenuOpen(false);
                          setMenuOpen(false);
                        }}
                      >
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              )}
            </>
          ) : null}
        </div>
      )}
    </nav>
  );
}
