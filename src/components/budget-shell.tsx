"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Button,
  Content,
  Header,
  HeaderGlobalBar,
  HeaderMenuButton,
  HeaderName,
  SideNav,
  SideNavItems,
  SideNavLink,
} from "@carbon/react";
import {
  Dashboard,
  DocumentImport,
  Finance,
  Growth,
  List,
  Money,
  Purchase,
  Renew,
  Settings,
} from "@carbon/icons-react";

const navItems = [
  { icon: Dashboard, href: "/overblik", label: "Overblik" },
  { icon: Money, href: "/indkomst", label: "Indkomst" },
  { icon: Purchase, href: "/udgifter", label: "Udgifter" },
  { icon: Growth, href: "/opsparing", label: "Opsparing" },
  { icon: DocumentImport, href: "/import", label: "Import" },
  { icon: List, href: "/poster", label: "Poster" },
];

export function BudgetShell({
  children,
  userEmail,
}: {
  children: ReactNode;
  userEmail?: string;
}) {
  const pathname = usePathname();
  const [isDesktop, setIsDesktop] = useState(false);
  const [isSideNavExpanded, setIsSideNavExpanded] = useState(false);
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1056px)");
    const syncSideNav = () => {
      setIsDesktop(mediaQuery.matches);
      setIsSideNavExpanded(mediaQuery.matches);
    };

    syncSideNav();
    mediaQuery.addEventListener("change", syncSideNav);

    return () => mediaQuery.removeEventListener("change", syncSideNav);
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => setNow(new Date()), 0);
    const interval = window.setInterval(() => setNow(new Date()), 30_000);

    return () => {
      window.clearTimeout(timeout);
      window.clearInterval(interval);
    };
  }, []);

  function closeSideNavAfterNavigation() {
    if (!isDesktop) {
      setIsSideNavExpanded(false);
    }
  }

  async function syncBankData() {
    await fetch("/api/bank/sync", {
      method: "POST",
      cache: "no-store",
    }).catch(() => undefined);

    window.dispatchEvent(new Event("familybalance:sync"));
  }

  async function signOut() {
    await fetch("/auth/logout", {
      method: "POST",
      cache: "no-store",
    });

    window.location.href = "/login";
  }

  return (
    <>
      <Header aria-label="Budget">
        <HeaderMenuButton
          aria-label={isSideNavExpanded ? "Luk navigation" : "Åbn navigation"}
          className="budget-menu-button"
          isActive={isSideNavExpanded}
          onClick={() => setIsSideNavExpanded((isExpanded) => !isExpanded)}
        />
        <HeaderName as={Link} href="/overblik" prefix="">
          FamilyBalance
        </HeaderName>
        <HeaderGlobalBar>
          {now ? (
            <time className="header-clock" dateTime={now.toISOString()}>
              {new Intl.DateTimeFormat("da-DK", {
                dateStyle: "medium",
                timeStyle: "short",
              }).format(now)}
            </time>
          ) : null}
          <div className="header-actions">
            {userEmail ? <span className="header-user">{userEmail}</span> : null}
            <Button
              size="sm"
              renderIcon={Finance}
              onClick={() => {
                window.location.href = "/api/bank/connect";
              }}
            >
              Forbind bank
            </Button>
            <Button
              size="sm"
              kind="secondary"
              renderIcon={Renew}
              onClick={syncBankData}
            >
              Synkroniser nu
            </Button>
            <Button
              hasIconOnly
              iconDescription="Indstillinger"
              kind="ghost"
              renderIcon={Settings}
              size="sm"
              tooltipPosition="bottom"
            />
            {userEmail ? (
              <Button kind="ghost" onClick={signOut} size="sm">
                Log ud
              </Button>
            ) : null}
          </div>
        </HeaderGlobalBar>
      </Header>

      <SideNav
        aria-label="Primær navigation"
        expanded={isSideNavExpanded}
        isPersistent
        onOverlayClick={() => setIsSideNavExpanded(false)}
      >
        <SideNavItems>
          {navItems.map((item) => (
            <SideNavLink
              as={Link}
              key={item.href}
              href={item.href}
              isActive={pathname === item.href}
              renderIcon={item.icon}
              onClick={closeSideNavAfterNavigation}
            >
              {item.label}
            </SideNavLink>
          ))}
        </SideNavItems>
      </SideNav>

      <Content className="budget-shell" id="main-content">
        <nav className="mobile-section-nav" aria-label="Sektioner">
          {navItems.map((item) => (
            <Link
              aria-current={pathname === item.href ? "page" : undefined}
              key={item.href}
              href={item.href}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        {children}
      </Content>
    </>
  );
}
