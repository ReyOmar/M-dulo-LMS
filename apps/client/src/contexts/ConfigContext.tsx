"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";
import api from "@/lib/api";
import { useWS } from "./WebSocketContext";

export interface LMSConfig {
  id: number;
  nombre_plataforma: string;
  logo_url?: string | null;
  favicon_url?: string | null;
  color_primario: string;
  color_secundario: string;
  fuente: string;
  border_radius: number;
  login_fondo_url?: string | null;
  mensaje_bienvenida: string;
  idioma: string;
  zona_horaria: string;
  // Landing Page
  landing_hero_titulo1?: string;
  landing_hero_titulo2?: string;
  landing_hero_subtitulo?: string;
  landing_telefono?: string;
  landing_telefono_sub?: string;
  landing_email?: string;
  landing_email_sub?: string;
  landing_oficina?: string;
  landing_oficina_sub?: string;
  landing_footer_texto?: string;
  // Legal
  legal_terminos?: string;
  legal_privacidad?: string;
  legal_datos?: string;
}

interface ConfigContextType {
  config: LMSConfig | null;
  updateLocalTheme: (primary: string, secondary: string) => void;
  updateConfig: (partial: Partial<LMSConfig>) => void;
  saveConfigToServer: () => Promise<void>;
  // Legacy alias
  saveThemeToServer: () => Promise<void>;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

const hexToHsl = (hex: string): string => {
  hex = hex.replace(/^#/, "");
  if (hex.length === 3) {
    hex = hex.split("").map((x) => x + x).join("");
  }
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0, l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      case b: h = (r - g) / d + 4; break;
    }
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
};

const GOOGLE_FONTS = ['Inter', 'Roboto', 'Montserrat', 'Poppins', 'Outfit', 'Open Sans', 'Lato'];

/**
 * Resolves a file reference to a full download URL.
 * Handles both:
 * - Relative R2 keys: "logos/123-abc.png" → "{API_BASE_URL}/storage/download/logos/123-abc.png"
 * - Legacy absolute URLs: "http://..." → returned as-is
 * This ensures images work across environments (localhost, devtunnel, production).
 */
export function resolveFileUrl(fileRef: string | null | undefined): string | null {
  if (!fileRef) return null;
  // Already a full URL (legacy data) — return as-is
  if (fileRef.startsWith('http://') || fileRef.startsWith('https://')) return fileRef;
  // Relative key — build the download URL using current API base
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3200/api';
  return `${apiUrl}/storage/download/${fileRef}`;
}

function loadGoogleFont(fontName: string) {
  const id = `gfont-${fontName.replace(/\s/g, '-')}`;
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(fontName)}:wght@300;400;500;600;700;800;900&display=swap`;
  document.head.appendChild(link);
}

export function ConfigProvider({ children }: { children: ReactNode }) {
  const { subscribe } = useWS();
  
  const [config, setConfig] = useState<LMSConfig | null>(() => {
    // Instantly restore cached config to prevent flash of default theme
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('lms_config_cache');
        if (cached) {
          const parsed = JSON.parse(cached) as LMSConfig;
          // Apply cached theme to DOM immediately (synchronous, no flash)
          queueMicrotask(() => applyAllToDOM(parsed));
          return parsed;
        }
      } catch { /* ignore corrupt cache */ }
    }
    return null;
  });

  useEffect(() => {
    api.get("/configuracion")
      .then(({ data }) => {
        if (data) {
          setConfig(data);
          applyAllToDOM(data);
          if (data.nombre_plataforma) document.title = data.nombre_plataforma;
          // Cache for instant restore on next page load
          try { localStorage.setItem('lms_config_cache', JSON.stringify(data)); } catch {}
        }
      })
      .catch((err) => console.error("Could not load config", err));
  }, []);

  useEffect(() => {
    const unsub = subscribe('config:updated', (newConfig: any) => {
      if (newConfig) {
        setConfig(newConfig);
        applyAllToDOM(newConfig);
        if (newConfig.nombre_plataforma) document.title = newConfig.nombre_plataforma;
        try { localStorage.setItem('lms_config_cache', JSON.stringify(newConfig)); } catch {}
      }
    });
    return () => unsub();
  }, [subscribe]);

  const applyAllToDOM = (cfg: LMSConfig) => {
    // ── Colors ──
    if (cfg.color_primario) {
      const primHsl = hexToHsl(cfg.color_primario);
      document.documentElement.style.setProperty('--primary', primHsl);
      document.documentElement.style.setProperty('--ring', primHsl);
    }
    if (cfg.color_secundario) {
      const secHsl = hexToHsl(cfg.color_secundario);
      document.documentElement.style.setProperty('--secondary', secHsl);
    }

    // ── Font — load Google Font and inject a global style tag so ALL elements pick it up ──
    if (cfg.fuente) {
      loadGoogleFont(cfg.fuente);
      const fontFamily = `"${cfg.fuente}", ui-sans-serif, system-ui, sans-serif`;
      document.documentElement.style.setProperty('--font-sans', fontFamily);
      document.body.style.fontFamily = fontFamily;
    }

    // ── Border Radius — inject/update a persistent <style> tag that overrides every element ──
    // Tailwind v4 compiles --radius at build time, so runtime setProperty alone isn't enough.
    // We inject a global override style tag that wins via specificity.
    const radiusPx = cfg.border_radius ?? 12;
    const fontFamily2 = cfg.fuente ? `"${cfg.fuente}", ui-sans-serif, system-ui, sans-serif` : null;

    let styleTag = document.getElementById('lms-theme-override') as HTMLStyleElement | null;
    if (!styleTag) {
      styleTag = document.createElement('style');
      styleTag.id = 'lms-theme-override';
      document.head.appendChild(styleTag);
    }

    const fontRule = fontFamily2 ? `
      *, *::before, *::after { font-family: ${fontFamily2} !important; }
    ` : '';

    styleTag.textContent = `
      :root {
        --radius: ${radiusPx}px !important;
        --radius-sm: ${Math.max(0, radiusPx - 4)}px !important;
        --radius-md: ${Math.max(0, radiusPx - 2)}px !important;
        --radius-lg: ${radiusPx}px !important;
        --radius-xl: ${radiusPx > 0 ? radiusPx + 4 : 0}px !important;
        --radius-2xl: ${radiusPx > 0 ? radiusPx + 8 : 0}px !important;
        --radius-3xl: ${radiusPx > 0 ? radiusPx + 12 : 0}px !important;
        --radius-4xl: ${radiusPx > 0 ? radiusPx + 16 : 0}px !important;
      }
      ${fontRule}
    `;

    // ── Favicon (safe update — never remove React-managed nodes) ──
    const targetFavicon = resolveFileUrl(cfg.favicon_url) || `/favicon.ico?v=${Date.now()}`;
    
    // Find or create a single managed favicon link (avoid removing React-controlled nodes)
    let faviconLink = document.getElementById('lms-favicon') as HTMLLinkElement | null;
    if (!faviconLink) {
      faviconLink = document.createElement('link');
      faviconLink.id = 'lms-favicon';
      faviconLink.rel = 'icon';
      document.head.appendChild(faviconLink);
    }
    faviconLink.href = targetFavicon;
  };

  const updateLocalTheme = (primary: string, secondary: string) => {
    if (config) {
      const newCfg = { ...config, color_primario: primary, color_secundario: secondary };
      setConfig(newCfg);
      applyAllToDOM(newCfg);
    }
  };

  const updateConfig = (partial: Partial<LMSConfig>) => {
    if (config) {
      const newCfg = { ...config, ...partial };
      setConfig(newCfg);
      applyAllToDOM(newCfg);
      if (partial.nombre_plataforma) document.title = partial.nombre_plataforma;
    }
  };

  const showToast = (message: string, type: 'success' | 'error') => {
    const existing = document.getElementById('lms-toast');
    if (existing) existing.parentNode?.removeChild(existing);

    const toast = document.createElement('div');
    toast.id = 'lms-toast';
    toast.style.cssText = `
      position: fixed; top: 24px; left: 50%; transform: translateX(-50%) translateY(-20px);
      z-index: 9999; padding: 14px 28px; border-radius: 14px; font-weight: 700; font-size: 14px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.18); opacity: 0;
      transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      backdrop-filter: blur(12px); border: 1px solid;
    `;
    if (type === 'success') {
      const primary = config?.color_primario || '#4f46e5';
      toast.style.background = `${primary}18`;
      toast.style.color = primary;
      toast.style.borderColor = `${primary}40`;
    } else {
      toast.style.background = '#dc262618';
      toast.style.color = '#dc2626';
      toast.style.borderColor = '#dc262640';
    }
    toast.textContent = message;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(-50%) translateY(-20px)';
      setTimeout(() => toast.parentNode?.removeChild(toast), 400);
    }, 3000);
  };

  const saveConfigToServer = async () => {
    if (!config) return;
    try {
      await api.post("/configuracion", {
        nombre_plataforma: config.nombre_plataforma,
        color_primario: config.color_primario,
        color_secundario: config.color_secundario,
        fuente: config.fuente,
        border_radius: config.border_radius,
        logo_url: config.logo_url || null,
        favicon_url: config.favicon_url || null,
        login_fondo_url: config.login_fondo_url || null,
        mensaje_bienvenida: config.mensaje_bienvenida,
      });
      showToast('✓ Configuración guardada permanentemente', 'success');
      // Update cache so next reload uses the saved theme instantly
      try { localStorage.setItem('lms_config_cache', JSON.stringify(config)); } catch {}
    } catch (e) {
      console.error(e);
      showToast('✕ Error guardando configuraciones', 'error');
    }
  };

  return (
    <ConfigContext.Provider value={{ config, updateLocalTheme, updateConfig, saveConfigToServer, saveThemeToServer: saveConfigToServer }}>
      {children}
    </ConfigContext.Provider>
  );
}

export function useConfig() {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error("useConfig must be used within a ConfigProvider");
  }
  return context;
}

export { GOOGLE_FONTS };
