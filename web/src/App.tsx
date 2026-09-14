import { NavLink, Route, Routes } from "react-router-dom";
import TableView from "./pages/TableView";
import MemberDetail from "./pages/MemberDetail";
import TreeView from "./pages/TreeView";
import CalendarView from "./pages/CalendarView";
import GameView from "./pages/GameView";
import LoginScreen from "./pages/LoginScreen";
import { useAuth } from "./auth/AuthContext";
import { useTheme } from "./theme/ThemeProvider";
import { Button } from "./components/ui";

function ThemeToggle() {
  const { flavor, toggle } = useTheme();
  return (
    <Button
      variant="ghost"
      onClick={toggle}
      title={flavor === "dark" ? "Switch to Latte (light)" : "Switch to Mocha (dark)"}
      aria-label="Toggle colour theme"
    >
      {flavor === "dark" ? "☀" : "☾"}
    </Button>
  );
}

export default function App() {
  const { authenticated, logout } = useAuth();

  if (authenticated === null) {
    return <div className="p-12 text-center text-sm text-ctp-subtext0">Loading...</div>;
  }

  if (!authenticated) {
    return <LoginScreen />;
  }

  return (
    <div className="min-h-screen">
      <header className="border-b border-ctp-surface0 bg-ctp-mantle">
        <div className="mx-auto flex max-w-5xl items-center gap-6 px-6 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-ctp-mauve">MaBigFam</h1>

          <nav className="flex gap-1">
            {[
              { to: "/", label: "Table", end: true },
              { to: "/tree", label: "Tree", end: false },
              { to: "/calendar", label: "Calendar", end: false },
              { to: "/game", label: "Game", end: false },
            ].map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  "rounded-lg px-3 py-1.5 text-sm font-medium transition " +
                  (isActive
                    ? "bg-ctp-blue/15 text-ctp-blue"
                    : "text-ctp-subtext0 hover:bg-ctp-surface0 hover:text-ctp-text")
                }
              >
                {item.label}
              </NavLink>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <Button variant="ghost" onClick={logout}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-6 py-6">
        <Routes>
          <Route path="/" element={<TableView />} />
          <Route path="/members/:id" element={<MemberDetail />} />
          <Route path="/tree" element={<TreeView />} />
          <Route path="/tree/:rootId" element={<TreeView />} />
          <Route path="/calendar" element={<CalendarView />} />
          <Route path="/game" element={<GameView />} />
        </Routes>
      </main>
    </div>
  );
}
