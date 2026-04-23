"use client";

import { useEffect, useState } from "react";

// Helper to convert hex to HSL format: "H S% L%"
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

export default function ThemeConfigurator() {
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Fetch global config
    fetch("http://localhost:3200/api/configuracion")
      .then((res) => res.json())
      .then((data) => {
        if (data && data.color_primario) {
          const mainHsl = hexToHsl(data.color_primario);
          document.documentElement.style.setProperty("--primary", mainHsl);
          document.documentElement.style.setProperty("--ring", mainHsl);
        }
        if (data && data.nombre_plataforma) {
            document.title = data.nombre_plataforma;
        }
      })
      .catch((err) => console.error("Error loading theme config", err))
      .finally(() => setLoading(false));
  }, []);

  return null; // Invisible config component
}
