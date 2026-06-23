"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ReactElement, useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/auth/useSession";

interface NavItem {
  readonly label: string;
  readonly href: string;
  readonly icon: string;
  /** If true, only exact pathname matches activate this link */
  readonly exact?: boolean;
}

interface NavBarProps {
  readonly canAccessHome?: boolean;
  readonly canAccessFilters?: boolean;
  readonly canAccessUserAdmin?: boolean;
}

const NAV_ITEMS: NavItem[] = [
  { label: "Home", href: "/", icon: "", exact: true },
  { label: "Dashboard", href: "/dashboard", icon: "", exact: true }
];

const ADMIN_NAV_ITEM: NavItem = { label: "Users", href: "/admin/users", icon: "" };

const FILTER_RULES_ITEMS: NavItem[] = [
  { label: "Numerator Filter", href: "/filters/numerator", icon: "" },
  { label: "Denominator Filter", href: "/filters/denominator", icon: "" }
];

function isNavItemActive(item: NavItem, pathname: string): boolean {
  return item.exact ? pathname === item.href : pathname.startsWith(item.href);
}

function DesktopFilterDropdown({
  filterMenuOpen,
  setFilterMenuOpen,
  filterMenuRef,
  pathname,
}: {
  readonly filterMenuOpen: boolean;
  readonly setFilterMenuOpen: (updater: (open: boolean) => boolean) => void;
  readonly filterMenuRef: React.RefObject<HTMLLIElement>;
  readonly pathname: string;
}): ReactElement {
  const isFilterActive = pathname.startsWith("/filters");
  return (
    <li ref={filterMenuRef} className="navbar-dropdown">
      <button
        type="button"
        className={`navbar-link navbar-dropdown-toggle${isFilterActive ? " navbar-link-active" : ""}`}
        aria-expanded={filterMenuOpen}
        aria-haspopup="menu"
        onClick={() => setFilterMenuOpen((open) => !open)}
      >
        <span className="navbar-link-icon" aria-hidden="true" />{" "}
        Filter Rules
        <span className="navbar-dropdown-arrow" aria-hidden="true">▾</span>
      </button>

      {filterMenuOpen && (
        <div className="navbar-dropdown-menu" role="menu">
          {FILTER_RULES_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);
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
  );
}

function MobileFilterSection({
  mobileFilterMenuOpen,
  setMobileFilterMenuOpen,
  setMenuOpen,
  pathname,
}: {
  readonly mobileFilterMenuOpen: boolean;
  readonly setMobileFilterMenuOpen: (updater: (open: boolean) => boolean) => void;
  readonly setMenuOpen: (value: boolean) => void;
  readonly pathname: string;
}): ReactElement {
  const isFilterActive = pathname.startsWith("/filters");
  return (
    <>
      <button
        type="button"
        role="menuitem"
        className={`navbar-mobile-link navbar-mobile-dropdown-toggle${isFilterActive ? " navbar-link-active" : ""}`}
        aria-expanded={mobileFilterMenuOpen}
        onClick={() => setMobileFilterMenuOpen((open) => !open)}
      >
        <span aria-hidden="true" />{" "}
        Filter Rules
        <span className="navbar-mobile-dropdown-arrow" aria-hidden="true">{mobileFilterMenuOpen ? "▴" : "▾"}</span>
      </button>

      {mobileFilterMenuOpen && (
        <div className="navbar-mobile-submenu" role="menu">
          {FILTER_RULES_ITEMS.map((item) => {
            const active = isNavItemActive(item, pathname);
            return (
              <Link
                key={item.href}
                href={item.href}
                role="menuitem"
                className={`navbar-mobile-link navbar-mobile-sublink${active ? " navbar-link-active" : ""}`}
                aria-current={active ? "page" : undefined}
                onClick={() => {
                  setMobileFilterMenuOpen(() => false);
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
  );
}

function MobileMenu({
  primaryNavItems,
  canAccessUserAdmin,
  canAccessFilters,
  mobileFilterMenuOpen,
  setMobileFilterMenuOpen,
  setMenuOpen,
  pathname,
}: {
  readonly primaryNavItems: NavItem[];
  readonly canAccessUserAdmin: boolean;
  readonly canAccessFilters: boolean;
  readonly mobileFilterMenuOpen: boolean;
  readonly setMobileFilterMenuOpen: (updater: (open: boolean) => boolean) => void;
  readonly setMenuOpen: (value: boolean) => void;
  readonly pathname: string;
}): ReactElement {
  return (
    <div className="navbar-mobile-menu" role="menu">
      {primaryNavItems.map((item) => {
        const active = isNavItemActive(item, pathname);
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
          className={`navbar-mobile-link${isNavItemActive(ADMIN_NAV_ITEM, pathname) ? " navbar-link-active" : ""}`}
          aria-current={isNavItemActive(ADMIN_NAV_ITEM, pathname) ? "page" : undefined}
          onClick={() => setMenuOpen(false)}
        >
          <span aria-hidden="true">{ADMIN_NAV_ITEM.icon}</span>
          {ADMIN_NAV_ITEM.label}
        </Link>
      ) : null}

      {canAccessFilters ? (
        <MobileFilterSection
          mobileFilterMenuOpen={mobileFilterMenuOpen}
          setMobileFilterMenuOpen={setMobileFilterMenuOpen}
          setMenuOpen={setMenuOpen}
          pathname={pathname}
        />
      ) : null}
    </div>
  );
}

/**
 * Primary application navigation bar.
 * Highlights the active route using next/navigation's usePathname.
 * Collapses to a hamburger menu on narrow viewports.
 * Uses sessionStorage-based session for role-based visibility.
 */
export function NavBar({
  canAccessHome: _canAccessHome,
  canAccessFilters: _canAccessFilters,
  canAccessUserAdmin: _canAccessUserAdmin
}: Readonly<NavBarProps>): ReactElement | null {
  const { session } = useSession();
  const role = session?.isActive ? session.role : null;

  const canAccessHome = role === "administrator";
  const canAccessFilters = role === "administrator" || role === "application_owner";
  const canAccessUserAdmin = role === "administrator";

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

  const primaryNavItems = canAccessHome ? NAV_ITEMS : NAV_ITEMS.filter((item) => item.href !== "/");

  if (pathname === "/login") {
    return null;
  }

  return (
    <nav className="navbar" aria-label="Main navigation">
      <div className="navbar-inner">
        {/* Desktop links */}
        <ul className="navbar-links">
          {primaryNavItems.map((item) => {
            const active = isNavItemActive(item, pathname);
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
                className={`navbar-link${isNavItemActive(ADMIN_NAV_ITEM, pathname) ? " navbar-link-active" : ""}`}
                aria-current={isNavItemActive(ADMIN_NAV_ITEM, pathname) ? "page" : undefined}
              >
                <span className="navbar-link-icon" aria-hidden="true">{ADMIN_NAV_ITEM.icon}</span>
                {ADMIN_NAV_ITEM.label}
              </Link>
            </li>
          ) : null}

          {canAccessFilters ? (
            <DesktopFilterDropdown
              filterMenuOpen={filterMenuOpen}
              setFilterMenuOpen={setFilterMenuOpen}
              filterMenuRef={filterMenuRef}
              pathname={pathname}
            />
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
        <MobileMenu
          primaryNavItems={primaryNavItems}
          canAccessUserAdmin={canAccessUserAdmin}
          canAccessFilters={canAccessFilters}
          mobileFilterMenuOpen={mobileFilterMenuOpen}
          setMobileFilterMenuOpen={setMobileFilterMenuOpen}
          setMenuOpen={setMenuOpen}
          pathname={pathname}
        />
      )}
    </nav>
  );
}
