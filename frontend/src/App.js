import React from "react";
import { HashRouter, Routes, Route, Navigate, useLocation, NavLink } from "react-router-dom";
import Kiosk from "./components/Kiosk";
import DisplayBoard from "./components/DisplayBoard";
import GuichetPanel from "./components/GuichetPanel";
import MobileScanView from "./components/MobileScanView";

function Header() {
  return (
    <header className="app-header">
      <div className="header-logo">
        <div className="header-logo-icon">🎫</div>
        <span>UIR <span style={{ color: "#818cf8" }}>FileQ</span></span>
      </div>
      <nav className="header-nav">
        <NavLink to="/kiosk" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          <span>🎟️</span> Kiosk
        </NavLink>
        <NavLink to="/affichage" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          <span>📺</span> Affichage
        </NavLink>
        <NavLink to="/guichet" className={({ isActive }) => `nav-link${isActive ? " active" : ""}`}>
          <span>🖥️</span> Agent
        </NavLink>
      </nav>
    </header>
  );
}

function Layout() {
  const location = useLocation();
  const hideHeader = location.pathname === "/mobile" || location.pathname === "/affichage";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
      {!hideHeader && <Header />}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route path="/" element={<Navigate to="/kiosk" replace />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/scan" element={<Kiosk />} />
          <Route path="/affichage" element={<DisplayBoard />} />
          <Route path="/guichet" element={<GuichetPanel />} />
          <Route path="/mobile" element={<MobileScanView />} />
          <Route path="*" element={<Navigate to="/kiosk" replace />} />
        </Routes>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <HashRouter>
      <Layout />
    </HashRouter>
  );
}
