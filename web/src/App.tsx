import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import Dashboard from "./pages/Dashboard";
import ContactsView from "./pages/ContactsView";
import MemberDetail from "./pages/MemberDetail";
import TreeView from "./pages/TreeView";
import BirthdaysView from "./pages/BirthdaysView";
import CalendarView from "./pages/CalendarView";
import GameView from "./pages/GameView";
import TrashView from "./pages/TrashView";
import LoginScreen from "./pages/LoginScreen";
import { useAuth } from "./auth/AuthContext";
import { useTheme } from "./theme/ThemeProvider";
import { Button } from "./components/ui";
import ErrorBoundary from "./components/ErrorBoundary";
import Icon from "./components/icons";
import Logo from "./components/Logo";
import type { IconName } from "./components/icons";

interface NavItem {
  to: string;
  label: string;
  icon: IconName;
  end?: boolean;
  /** Other path prefixes that should keep this tab lit (e.g. a contact's own page). */
  alsoActive?: string[];
  /** Left off the phone bottom bar (which holds five) — reachable from the dashboard. */
  desktopOnly?: boolean;
}

const NAV: NavItem[] = [
  { to: "/", label: "Home", icon: "home", end: true },
  { to: "/contacts", label: "Contacts", icon: "users", alsoActive: ["/members", "/trash"] },
  { to: "/tree", label: "Tree", icon: "tree" },
  { to: "/birthdays", label: "Birthdays", icon: "cake" },
  { to: "/calendar", label: "Calendar", icon: "calendar" },
  { to: "/game", label: "Game", icon: "game", desktopOnly: true },
];

function ThemeToggle() {
  const { flavor, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      title={flavor === "dark" ? "Switch to light theme" : "Switch to dark theme"}
      aria-label="Toggle colour theme"
      className="px-2.5"
    >
      <Icon name={flavor === "dark" ? "sun" : "moon"} className="size-5" />
    </Button>
  );
}

export default function App() {
  const { authenticated, logout } = useAuth();
  const location = useLocation();

  if (authenticated === null) {
    return <div className="p-12 text-center text-sm text-ctp-subtext0">Loading...</div>;
  }

  if (!authenticated) {
    return <LoginScreen />;
  }

  const lit = (item: NavItem, isActive: boolean) =>
    isActive || !!item.alsoActive?.some((prefix) => location.pathname.startsWith(prefix));

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ctp-surface0/80 bg-ctp-base/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-2.5 sm:px-6">
          <NavLink to="/" className="flex items-center gap-2.5 rounded-xl" aria-label="MaBigFam home">
            <Logo />
            <span className="font-display text-xl font-semibold tracking-tight text-ctp-text">
              MaBigFam
            </span>
          </NavLink>

          {/* Top tabs from sm up; below that the bottom bar takes over. */}
          <nav aria-label="Main" className="hidden gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition " +
                  (lit(item, isActive)
                    ? "bg-brand/12 text-brand"
                    : "text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text")
                }
              >
                <Icon name={item.icon} />
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" onClick={logout} aria-label="Sign out" title="Sign out" className="px-2.5 sm:px-3.5">
              <Icon name="logout" className="size-5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* pb-28 keeps the last row clear of the fixed bottom bar on phones. */}
      <main className="mx-auto max-w-6xl px-4 py-5 pb-28 sm:px-6 sm:py-8 sm:pb-10">
        {/* Keyed on the route so navigating away clears a previous crash. */}
        <ErrorBoundary key={location.pathname}>
          <div key={location.pathname} className="page-enter">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/contacts" element={<ContactsView />} />
              <Route path="/members/:id" element={<MemberDetail />} />
              <Route path="/tree" element={<TreeView />} />
              <Route path="/tree/:rootId" element={<TreeView />} />
              <Route path="/birthdays" element={<BirthdaysView />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/game" element={<GameView />} />
              <Route path="/trash" element={<TrashView />} />
            </Routes>
          </div>
        </ErrorBoundary>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ctp-surface0/80 bg-ctp-mantle/90
                   pb-[env(safe-area-inset-bottom)] backdrop-blur-md sm:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 px-2 pt-1.5 pb-1">
          {NAV.filter((item) => !item.desktopOnly).map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  "group flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition " +
                  (lit(item, isActive) ? "text-brand" : "text-ctp-subtext0 active:text-ctp-text")
                }
              >
                {({ isActive }) => (
                  <>
                    <span
                      className={
                        "flex h-7 w-12 items-center justify-center rounded-full transition " +
                        (lit(item, isActive) ? "bg-brand/12" : "group-active:bg-ctp-surface0")
                      }
                    >
                      <Icon name={item.icon} className="size-5" />
                    </span>
                    {item.label}
                  </>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
