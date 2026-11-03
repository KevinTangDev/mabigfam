import { NavLink, Route, Routes, useLocation } from "react-router-dom";
import TableView from "./pages/TableView";
import MemberDetail from "./pages/MemberDetail";
import TreeView from "./pages/TreeView";
import CalendarView from "./pages/CalendarView";
import GameView from "./pages/GameView";
import TrashView from "./pages/TrashView";
import LoginScreen from "./pages/LoginScreen";
import { useAuth } from "./auth/AuthContext";
import { useTheme } from "./theme/ThemeProvider";
import { Button } from "./components/ui";
import ErrorBoundary from "./components/ErrorBoundary";
import Icon from "./components/icons";
import type { IconName } from "./components/icons";

const NAV: { to: string; label: string; icon: IconName; end: boolean }[] = [
  { to: "/", label: "Family", icon: "users", end: true },
  { to: "/tree", label: "Tree", icon: "tree", end: false },
  { to: "/calendar", label: "Calendar", icon: "calendar", end: false },
  { to: "/game", label: "Game", icon: "game", end: false },
];

function ThemeToggle() {
  const { flavor, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      title={flavor === "dark" ? "Switch to Latte (light)" : "Switch to Mocha (dark)"}
      aria-label="Toggle colour theme"
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

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-ctp-surface0 bg-ctp-mantle/85 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-4 py-2 sm:px-6">
          <h1 className="text-lg font-semibold tracking-tight text-ctp-mauve">MaBigFam</h1>

          {/* Top tabs from sm up; below that the bottom bar takes over. */}
          <nav aria-label="Main" className="hidden gap-1 sm:flex">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  "inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (isActive
                    ? "bg-ctp-blue/15 text-ctp-blue"
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
            <Button variant="ghost" onClick={logout} aria-label="Sign out" title="Sign out">
              <Icon name="logout" className="size-5" />
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        </div>
      </header>

      {/* pb-24 keeps the last row clear of the fixed bottom bar on phones. */}
      <main className="mx-auto max-w-5xl px-4 py-5 pb-24 sm:px-6 sm:py-6 sm:pb-6">
        {/* Keyed on the route so navigating away clears a previous crash. */}
        <ErrorBoundary key={location.pathname}>
          <Routes>
            <Route path="/" element={<TableView />} />
            <Route path="/members/:id" element={<MemberDetail />} />
            <Route path="/tree" element={<TreeView />} />
            <Route path="/tree/:rootId" element={<TreeView />} />
            <Route path="/calendar" element={<CalendarView />} />
            <Route path="/game" element={<GameView />} />
            <Route path="/trash" element={<TrashView />} />
          </Routes>
        </ErrorBoundary>
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-ctp-surface0 bg-ctp-mantle/95
                   pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-4">
          {NAV.map((item) => (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition " +
                  (isActive ? "text-ctp-blue" : "text-ctp-subtext0 hover:text-ctp-text")
                }
              >
                <Icon name={item.icon} className="size-5" />
                {item.label}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
