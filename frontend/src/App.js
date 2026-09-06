import React from "react";
import { HashRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import Header from "./components/Header";
import Kiosk from "./components/Kiosk";
import DisplayBoard from "./components/DisplayBoard";
import GuichetPanel from "./components/GuichetPanel";
import MobileScanView from "./components/MobileScanView";

// Wrapper that hides the header on mobile scan page
function Layout() {
  const location = useLocation();
  const isMobile = location.pathname === "/mobile";

  return (
    <div className="min-h-screen bg-background text-on-surface flex flex-col">
      {!isMobile && <Header />}
      <div className="flex-1 w-full">
        <Routes>
          <Route path="/" element={<Navigate to="/kiosk" replace />} />
          <Route path="/kiosk" element={<Kiosk />} />
          <Route path="/scan" element={<Kiosk />} />
          <Route path="/affichage" element={<DisplayBoard />} />
          <Route path="/guichet" element={<GuichetPanel />} />
          {/* Mobile-only page — no header, full-screen */}
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
