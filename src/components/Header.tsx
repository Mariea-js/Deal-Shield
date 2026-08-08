import { useCallback, useEffect, useRef, useState } from "react";
import { ShieldCheck, Sun, Moon, Menu, X } from "lucide-react";
import { useTheme } from "../ThemeContext";

export type HeaderNavItem = "home" | "analyze" | "vendor" | "about" | "dashboard";

interface HeaderProps {
  activeNav: HeaderNavItem;
  onNavigate: (item: HeaderNavItem) => void;
  onTryDemo: () => void;
}

const NAV_ITEMS: { id: HeaderNavItem; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "analyze", label: "Analyze Contract" },
  { id: "vendor", label: "Check Vendor" },
  { id: "about", label: "About" },
];

export function Header({ activeNav, onNavigate, onTryDemo }: HeaderProps) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const { theme, toggleTheme } = useTheme();

  // Close mobile menu on Escape
  useEffect(() => {
    if (!mobileOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [mobileOpen]);

  // Trap focus inside mobile menu when open
  useEffect(() => {
    if (!mobileOpen || !menuRef.current) return;
    const focusable = menuRef.current.querySelectorAll<HTMLElement>(
      'a, button, [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const handleTab = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleTab);
    first.focus();
    return () => document.removeEventListener("keydown", handleTab);
  }, [mobileOpen]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [mobileOpen]);

  const handleNavClick = useCallback(
    (item: HeaderNavItem) => {
      setMobileOpen(false);
      onNavigate(item);
    },
    [onNavigate]
  );

  const handleLogoClick = useCallback(() => {
    setMobileOpen(false);
    onNavigate("home");
  }, [onNavigate]);

  const handleDemo = useCallback(() => {
    setMobileOpen(false);
    onTryDemo();
  }, [onTryDemo]);

  return (
    <header
      className="fixed inset-x-0 top-0 z-50 h-[72px] border-b border-border/20 bg-background/85 shadow-[0_4px_24px_rgba(0,0,0,0.20)] backdrop-blur-xl rounded-b-[13px]"
    >
      <div className="mx-auto flex h-full max-w-[1200px] items-center justify-between px-4 md:px-6">
        {/* ── Left: Logo group ── */}
        <button
          onClick={handleLogoClick}
          className="flex shrink-0 cursor-pointer items-start gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
          style={{ "--tw-ring-color": "#2563EB" } as React.CSSProperties}
          aria-label="Deal Shield — Home"
        >
          <ShieldCheck
            className="h-8 w-8 shrink-0 text-brand"
            aria-hidden="true"
          />
          <div className="flex flex-col leading-none">
            <span className="text-lg font-bold tracking-tight whitespace-nowrap text-foreground">
              Deal Shield
            </span>
            <span className="mt-0.5 text-[11px] leading-tight whitespace-nowrap text-text-muted">
              Know the risk before you sign.
            </span>
          </div>
        </button>

        {/* ── Center: Desktop nav ── */}
        <nav
          className="hidden md:flex md:items-center md:gap-8"
          aria-label="Main navigation"
        >
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`relative cursor-pointer py-1 text-sm leading-none transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent ${isActive ? "text-brand" : "text-text-muted hover:text-text-secondary"}`}
                style={{ opacity: isActive ? 1 : 0.8 }}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
                {isActive && (
                  <span
                    className="absolute -bottom-1 left-1/2 h-0.5 w-4 -translate-x-1/2 rounded-full bg-brand"
                    aria-hidden="true"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Right: Actions ── */}
        <div className="flex items-center gap-4">
          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent text-text-muted"
            style={{ "--tw-ring-color": "#2563EB" } as React.CSSProperties}
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Moon className="h-4 w-4" aria-hidden="true" />
            )}
          </button>

          {/* Try Demo (desktop) */}
          <button
            onClick={handleDemo}
            className="hidden cursor-pointer rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:inline-flex md:items-center"
            style={{
              backgroundColor: "#2563EB",
              color: "#F8FAFC",
              height: "40px",
              lineHeight: "1",
            }}
          >
            Try Demo
          </button>

          {/* Mobile menu toggle */}
          <button
            ref={toggleRef}
            type="button"
            onClick={() => setMobileOpen((prev) => !prev)}
            className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg transition-colors duration-150 hover:bg-white/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent md:hidden text-text-muted"
            style={{ "--tw-ring-color": "#2563EB" } as React.CSSProperties}
            aria-label={mobileOpen ? "Close navigation menu" : "Open navigation menu"}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
          >
            {mobileOpen ? (
              <X className="h-5 w-5" aria-hidden="true" />
            ) : (
              <Menu className="h-5 w-5" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>

      {/* ── Mobile menu panel ── */}
      <div
        id="mobile-menu"
        ref={menuRef}
        role="dialog"
        aria-modal="true"
        aria-label="Navigation menu"
        className="absolute inset-x-0 top-full overflow-hidden transition-all duration-200 ease-out md:hidden bg-background/97"
        style={{
          maxHeight: mobileOpen ? "480px" : "0px",
          opacity: mobileOpen ? 1 : 0,
          borderColor: mobileOpen ? "var(--color-border)" : "transparent",
          borderBottomWidth: mobileOpen ? "1px" : "0px",
          backdropFilter: "blur(16px)",
          borderRadius: "0 0 13px 13px",
        }}
      >
        <nav className="flex flex-col gap-1 px-4 pb-6 pt-4" aria-label="Mobile navigation">
          {NAV_ITEMS.map((item) => {
            const isActive = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`flex w-full cursor-pointer items-center rounded-lg px-3 py-2.5 text-left text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 ${isActive ? "text-brand bg-brand/8" : "text-text-muted"}`}
                aria-current={isActive ? "page" : undefined}
              >
                {item.label}
              </button>
            );
          })}

          {/* Divider */}
          <div className="my-3 border-t border-border/15" />

          {/* Try Demo (mobile) */}
          <button
            onClick={handleDemo}
            className="flex w-full cursor-pointer items-center justify-center rounded-lg px-4 py-2.5 text-sm font-semibold transition-all duration-150 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2"
            style={{
              backgroundColor: "#2563EB",
              color: "#F8FAFC",
            }}
          >
            Try Demo
          </button>
        </nav>
      </div>
    </header>
  );
}