"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from "react";

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
  const [config, setConfig] = useState<LMSConfig | null>(null);

  useEffect(() => {
    fetch("http://localhost:3200/api/configuracion")
      .then((res) => res.json())
      .then((data) => {
        if (data) {
          setConfig(data);
          applyAllToDOM(data);
          if (data.nombre_plataforma) document.title = data.nombre_plataforma;
        }
      })
      .catch((err) => console.error("Could not load config", err));
  }, []);

  const applyAllToDOM = (cfg: LMSConfig) => {
    if (cfg.color_primario) {
      const primHsl = hexToHsl(cfg.color_primario);
      document.documentElement.style.setProperty('--primary', primHsl);
      document.documentElement.style.setProperty('--ring', primHsl);
    }
    if (cfg.color_secundario) {
      const secHsl = hexToHsl(cfg.color_secundario);
      document.documentElement.style.setProperty('--secondary', secHsl);
    }
    if (cfg.fuente) {
      loadGoogleFont(cfg.fuente);
      document.documentElement.style.setProperty('--font-sans', `"${cfg.fuente}", ui-sans-serif, system-ui, sans-serif`);
      document.body.style.fontFamily = `"${cfg.fuente}", ui-sans-serif, system-ui, sans-serif`;
    }
    if (cfg.border_radius !== undefined) {
      document.documentElement.style.setProperty('--radius', `${cfg.border_radius}px`);
    }
    if (cfg.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = cfg.favicon_url;
    }
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
    if (existing) existing.remove();

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
      setTimeout(() => toast.remove(), 400);
    }, 3000);
  };

  const saveConfigToServer = async () => {
    if (!config) return;
    try {
      await fetch("http://localhost:3200/api/configuracion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombre_plataforma: config.nombre_plataforma,
          color_primario: config.color_primario,
          color_secundario: config.color_secundario,
          fuente: config.fuente,
          border_radius: config.border_radius,
          logo_url: config.logo_url || null,
          favicon_url: config.favicon_url || null,
          login_fondo_url: config.login_fondo_url || null,
          mensaje_bienvenida: config.mensaje_bienvenida,
        }),
      });
      showToast('✓ Configuración guardada permanentemente', 'success');
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
