import { NavLink, Route, Routes } from "react-router-dom";
import TableView from "./pages/TableView";
import MemberDetail from "./pages/MemberDetail";
import TreeView from "./pages/TreeView";

export default function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>MaBigFam</h1>
        <nav>
          <NavLink to="/" end>
            Table
          </NavLink>
          <NavLink to="/tree">Tree</NavLink>
        </nav>
      </header>

      <main className="app-main">
        <Routes>
          <Route path="/" element={<TableView />} />
          <Route path="/members/:id" element={<MemberDetail />} />
          <Route path="/tree" element={<TreeView />} />
          <Route path="/tree/:rootId" element={<TreeView />} />
        </Routes>
      </main>
    </div>
  );
}
