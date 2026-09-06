import React from "react";
import { NavLink } from "react-router-dom";

export default function Header({ currentGuichet = 3 }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-surface-container-high/60 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
      <div className="h-16 md:h-20 max-w-[1440px] mx-auto px-margin-page-mobile lg:px-margin-page-desktop flex items-center justify-between gap-space-md">
        
        {/* Brand / Logo */}
        <NavLink to="/kiosk" className="flex items-center gap-space-md hover:opacity-90 transition-opacity">
          <div className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center text-on-primary shadow-sm shrink-0">
            <span className="material-symbols-outlined text-[24px]">school</span>
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-space-xs">
              <span className="font-headline-sm text-headline-sm text-on-surface tracking-tight font-bold">
                Scolarité Numérique
              </span>
              <span className="hidden sm:inline-block text-on-surface-variant font-label-caption text-label-caption">
                — Campus Central
              </span>
            </div>
            <div className="flex items-center gap-space-2xs mt-0.5">
              <span className="inline-block w-2 h-2 rounded-full bg-on-tertiary-container animate-pulse"></span>
              <span className="font-label-caption text-label-caption text-secondary font-semibold">
                Accueil des étudiants • 7 guichets ouverts
              </span>
            </div>
          </div>
        </NavLink>

        {/* Center Nav */}
        <nav className="hidden md:flex items-center gap-space-xs p-1 bg-surface-container rounded-lg shadow-inner">
          <NavLink
            to="/kiosk"
            className={({ isActive }) =>
              `px-space-md py-space-xs rounded-lg font-body-sm text-body-sm transition-all ${
                isActive
                  ? "bg-primary-container text-on-primary font-semibold shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`
            }
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">qr_code_scanner</span>
              Scan &amp; Borne QR
            </span>
          </NavLink>

          <NavLink
            to="/affichage"
            className={({ isActive }) =>
              `px-space-md py-space-xs rounded-lg font-body-sm text-body-sm transition-all ${
                isActive
                  ? "bg-primary-container text-on-primary font-semibold shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`
            }
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">tv</span>
              Grand Écran Public
            </span>
          </NavLink>

          <NavLink
            to="/guichet"
            className={({ isActive }) =>
              `px-space-md py-space-xs rounded-lg font-body-sm text-body-sm transition-all ${
                isActive
                  ? "bg-primary-container text-on-primary font-semibold shadow-sm"
                  : "text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface"
              }`
            }
          >
            <span className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-[18px]">desk</span>
              Poste Guichet (G{currentGuichet})
            </span>
          </NavLink>
        </nav>

        {/* Right Info / Agent Avatar */}
        <div className="flex items-center gap-space-sm">
          <NavLink
            to="/kiosk"
            className="md:hidden flex items-center justify-center p-2 rounded-lg bg-surface-container text-on-surface"
            title="Borne"
          >
            <span className="material-symbols-outlined text-[20px]">qr_code_scanner</span>
          </NavLink>
          <NavLink
            to="/affichage"
            className="md:hidden flex items-center justify-center p-2 rounded-lg bg-surface-container text-on-surface"
            title="Écran"
          >
            <span className="material-symbols-outlined text-[20px]">tv</span>
          </NavLink>
          <NavLink
            to="/guichet"
            className="md:hidden flex items-center justify-center p-2 rounded-lg bg-surface-container text-on-surface"
            title="Guichet"
          >
            <span className="material-symbols-outlined text-[20px]">desk</span>
          </NavLink>

          <div className="hidden lg:flex flex-col text-right">
            <span className="font-label-caption text-label-caption font-semibold text-on-surface">
              Guichet 0{currentGuichet} Connecté
            </span>
            <span className="font-label-caption text-label-caption text-on-surface-variant">
              Opérateur Scolarité
            </span>
          </div>
          <div className="w-9 h-9 rounded-full bg-primary flex items-center justify-center text-on-primary shadow-sm">
            <span className="material-symbols-outlined text-[20px]">person</span>
          </div>
        </div>

      </div>
    </header>
  );
}
