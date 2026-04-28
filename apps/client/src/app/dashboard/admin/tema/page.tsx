"use client";

import { useConfig, GOOGLE_FONTS } from "@/contexts/ConfigContext";
import { useRole } from "@/contexts/RoleContext";
import { Palette, Save, Eye, Upload, Type, RectangleHorizontal, Image, Sparkles, GraduationCap } from "lucide-react";
import { useRef, useState } from "react";

const THEME_PRESETS = [
  { name: 'Corporativo', primary: '#1e3a8a', secondary: '#ea580c', desc: 'Azul serio y naranja vibrante' },
  { name: 'Noche Elegante', primary: '#8b5cf6', secondary: '#f59e0b', desc: 'Violeta profundo y dorado' },
  { name: 'Bosque', primary: '#166534', secondary: '#65a30d', desc: 'Verdes naturales y frescos' },
  { name: 'Océano', primary: '#0284c7', secondary: '#06b6d4', desc: 'Azules claros y cyan' },
  { name: 'Elegancia', primary: '#1f2937', secondary: '#d97706', desc: 'Gris oscuro y ámbar' },
  { name: 'Coral', primary: '#dc2626', secondary: '#f97316', desc: 'Rojo y naranja cálido' },
];

export default function TemaPage() {
  const { config, updateLocalTheme, updateConfig, saveConfigToServer } = useConfig();
  const { realRole } = useRole();
  const logoInputRef = useRef<HTMLInputElement>(null);
  const faviconInputRef = useRef<HTMLInputElement>(null);
  const loginBgInputRef = useRef<HTMLInputElement>(null);

  if (realRole !== "admin") {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <p className="text-muted-foreground font-bold">No tienes permisos para acceder a esta sección.</p>
      </div>
    );
  }

  const handleFileUpload = (field: 'logo_url' | 'favicon_url' | 'login_fondo_url') => (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      updateConfig({ [field]: reader.result as string });
    };
    reader.readAsDataURL(file);
  };

  return (
    <div className="animate-in fade-in duration-700 max-w-4xl">
      <header className="mb-10">
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <Palette className="h-8 w-8 text-primary" />
          Tema y Apariencia
        </h1>
        <p className="text-muted-foreground mt-2">Personaliza la identidad visual, colores, tipografía y experiencia de la plataforma.</p>
      </header>

      {/* ======= IDENTITY & BRANDING ======= */}
      <section className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><GraduationCap className="h-5 w-5 text-primary" /> Identidad de Marca</h2>
        
        <div className="space-y-6">
          {/* Platform Name */}
          <div>
            <label className="text-sm font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Nombre de la Plataforma</label>
            <input
              type="text"
              value={config?.nombre_plataforma || ''}
              onChange={(e) => updateConfig({ nombre_plataforma: e.target.value })}
              className="w-full sm:w-96 h-11 px-4 rounded-xl border border-border bg-background text-foreground font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              placeholder="PESV Education"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Aparece en la barra lateral y en el título del navegador</p>
          </div>

          {/* Logo Upload */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Logo</label>
              <div 
                onClick={() => logoInputRef.current?.click()}
                className="h-32 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-muted/20 group"
              >
                {config?.logo_url ? (
                  <img src={config.logo_url} alt="Logo" className="max-h-24 max-w-full object-contain" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                    <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Click para subir logo</p>
                  </>
                )}
              </div>
              <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload('logo_url')} />
            </div>

            {/* Favicon Upload */}
            <div>
              <label className="text-sm font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Favicon</label>
              <div 
                onClick={() => faviconInputRef.current?.click()}
                className="h-32 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-muted/20 group"
              >
                {config?.favicon_url ? (
                  <img src={config.favicon_url} alt="Favicon" className="h-12 w-12 object-contain" />
                ) : (
                  <>
                    <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                    <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Click para subir favicon</p>
                  </>
                )}
              </div>
              <input ref={faviconInputRef} type="file" accept="image/x-icon,image/png,image/svg+xml" className="hidden" onChange={handleFileUpload('favicon_url')} />
              <p className="text-xs text-muted-foreground mt-1.5">Ícono de la pestaña del navegador (.ico, .png, .svg)</p>
            </div>
          </div>
        </div>
      </section>

      {/* ======= COLORS ======= */}
      <section className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Palette className="h-5 w-5 text-primary" /> Colores de la Plataforma</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
          <div>
            <label className="text-sm font-bold text-muted-foreground mb-3 block uppercase tracking-wider">Color Primario</label>
            <div className="flex items-center gap-4">
              <input 
                type="color" 
                value={config?.color_primario || "#000000"} 
                onChange={(e) => updateLocalTheme(e.target.value, config?.color_secundario || "#000")}
                className="h-14 w-14 cursor-pointer rounded-xl overflow-hidden border-2 border-border shadow-sm" 
              />
              <div className="flex-1">
                <p className="text-sm font-mono text-foreground">{config?.color_primario || "#000000"}</p>
                <p className="text-xs text-muted-foreground mt-1">Botones, enlaces y acentos principales</p>
              </div>
            </div>
          </div>
          <div>
            <label className="text-sm font-bold text-muted-foreground mb-3 block uppercase tracking-wider">Color Secundario</label>
            <div className="flex items-center gap-4">
              <input 
                type="color" 
                value={config?.color_secundario || "#000000"} 
                onChange={(e) => updateLocalTheme(config?.color_primario || "#000", e.target.value)}
                className="h-14 w-14 cursor-pointer rounded-xl overflow-hidden border-2 border-border shadow-sm" 
              />
              <div className="flex-1">
                <p className="text-sm font-mono text-foreground">{config?.color_secundario || "#000000"}</p>
                <p className="text-xs text-muted-foreground mt-1">Elementos secundarios y gradientes</p>
              </div>
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="mt-8 p-6 border border-border rounded-xl bg-muted/20">
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mb-4 flex items-center gap-2"><Eye className="h-3 w-3" /> Vista Previa</p>
          <div className="flex flex-wrap gap-3">
            <button className="bg-primary text-primary-foreground px-5 py-2 rounded-xl font-bold text-sm shadow-sm">Botón Primario</button>
            <button className="bg-secondary text-secondary-foreground px-5 py-2 rounded-xl font-bold text-sm shadow-sm">Botón Secundario</button>
            <button className="border border-primary text-primary px-5 py-2 rounded-xl font-bold text-sm">Borde Primario</button>
            <div className="flex items-center gap-2 ml-auto">
              <div className="h-8 w-8 rounded-full bg-primary" title="Primario" />
              <div className="h-8 w-8 rounded-full bg-secondary" title="Secundario" />
            </div>
          </div>
        </div>
      </section>

      {/* ======= THEME PRESETS ======= */}
      <section className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold mb-2 flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" /> Temas Predefinidos</h2>
        <p className="text-sm text-muted-foreground mb-6">Aplica un tema completo con un solo click. Los colores se actualizan en vivo.</p>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          {THEME_PRESETS.map((preset) => (
            <button
              key={preset.name}
              onClick={() => updateLocalTheme(preset.primary, preset.secondary)}
              className="group p-4 rounded-xl border-2 border-border hover:border-primary/40 transition-all hover:shadow-md hover:-translate-y-0.5 duration-300 text-left"
            >
              <div className="flex gap-2 mb-3">
                <div className="h-8 w-8 rounded-full shadow-inner border border-white/20" style={{ background: preset.primary }} />
                <div className="h-8 w-8 rounded-full shadow-inner border border-white/20" style={{ background: preset.secondary }} />
              </div>
              <p className="font-bold text-sm">{preset.name}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{preset.desc}</p>
            </button>
          ))}
        </div>
      </section>

      {/* ======= TYPOGRAPHY ======= */}
      <section className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Type className="h-5 w-5 text-primary" /> Tipografía</h2>
        
        <div>
          <label className="text-sm font-bold text-muted-foreground mb-3 block uppercase tracking-wider">Fuente Principal</label>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {GOOGLE_FONTS.map((font) => (
              <button
                key={font}
                onClick={() => updateConfig({ fuente: font })}
                className={`p-4 rounded-xl border-2 transition-all text-left ${
                  config?.fuente === font
                    ? 'border-primary bg-primary/10 shadow-md'
                    : 'border-border hover:border-primary/30 hover:bg-muted/30'
                }`}
              >
                <p className="font-bold text-lg" style={{ fontFamily: `"${font}", sans-serif` }}>Aa</p>
                <p className="text-xs font-medium mt-1 text-muted-foreground">{font}</p>
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ======= BORDER RADIUS ======= */}
      <section className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><RectangleHorizontal className="h-5 w-5 text-primary" /> Redondez de Bordes</h2>
        
        <div className="space-y-4">
          <div className="flex items-center gap-6">
            <input 
              type="range" 
              min="0" 
              max="24" 
              value={config?.border_radius ?? 12} 
              onChange={(e) => updateConfig({ border_radius: parseInt(e.target.value) })}
              className="flex-1 h-2 bg-muted rounded-full appearance-none cursor-pointer accent-primary"
            />
            <span className="text-sm font-mono font-bold w-14 text-center bg-muted/50 px-2 py-1 rounded-lg">{config?.border_radius ?? 12}px</span>
          </div>
          
          {/* Live preview of radius */}
          <div className="flex gap-4 items-center pt-2">
            <div className="h-16 w-32 bg-primary/20 border-2 border-primary/30 flex items-center justify-center text-xs font-bold text-primary" style={{ borderRadius: `${config?.border_radius ?? 12}px` }}>
              Tarjeta
            </div>
            <button className="bg-primary text-primary-foreground px-6 py-2 font-bold text-sm" style={{ borderRadius: `${config?.border_radius ?? 12}px` }}>
              Botón
            </button>
            <div className="h-10 w-48 border-2 border-border bg-background flex items-center px-3 text-xs text-muted-foreground" style={{ borderRadius: `${config?.border_radius ?? 12}px` }}>
              Input de texto...
            </div>
          </div>
          
          <div className="flex gap-2 pt-2">
            {[0, 4, 8, 12, 16, 24].map((val) => (
              <button
                key={val}
                onClick={() => updateConfig({ border_radius: val })}
                className={`text-xs px-3 py-1.5 rounded-lg border transition-all font-medium ${
                  config?.border_radius === val
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border hover:border-primary/30 text-muted-foreground'
                }`}
              >
                {val === 0 ? 'Cuadrado' : val === 24 ? 'Redondeado' : `${val}px`}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* ======= LOGIN CUSTOMIZATION ======= */}
      <section className="bg-card/70 backdrop-blur-md border border-border/50 rounded-2xl p-8 shadow-sm mb-8 animate-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-xl font-bold mb-6 flex items-center gap-2"><Image className="h-5 w-5 text-primary" /> Pantalla de Inicio de Sesión</h2>
        
        <div className="space-y-6">
          {/* Welcome Message */}
          <div>
            <label className="text-sm font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Mensaje de Bienvenida</label>
            <input
              type="text"
              value={config?.mensaje_bienvenida || ''}
              onChange={(e) => updateConfig({ mensaje_bienvenida: e.target.value })}
              className="w-full sm:w-96 h-11 px-4 rounded-xl border border-border bg-background text-foreground font-medium focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all"
              placeholder="Bienvenido PESV"
            />
            <p className="text-xs text-muted-foreground mt-1.5">Se muestra en grande dentro del formulario de acceso</p>
          </div>

          {/* Login Background */}
          <div>
            <label className="text-sm font-bold text-muted-foreground mb-2 block uppercase tracking-wider">Fondo de Pantalla de Login</label>
            <div 
              onClick={() => loginBgInputRef.current?.click()}
              className="h-40 border-2 border-dashed border-border hover:border-primary/50 rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all hover:bg-muted/20 group overflow-hidden relative"
            >
              {config?.login_fondo_url ? (
                <>
                  <img src={config.login_fondo_url} alt="Fondo login" className="absolute inset-0 w-full h-full object-cover opacity-60" />
                  <div className="relative z-10 bg-card/80 backdrop-blur-sm px-4 py-2 rounded-lg">
                    <p className="text-xs font-bold">Click para cambiar imagen</p>
                  </div>
                </>
              ) : (
                <>
                  <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-2" />
                  <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors">Click para subir imagen de fondo</p>
                  <p className="text-xs text-muted-foreground mt-1">Recomendado: 1920Ã—1080 o mayor</p>
                </>
              )}
            </div>
            <input ref={loginBgInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload('login_fondo_url')} />
            {config?.login_fondo_url && (
              <button 
                onClick={() => updateConfig({ login_fondo_url: null })}
                className="text-xs text-destructive hover:text-destructive/80 font-medium mt-2 transition-colors"
              >
                Eliminar fondo personalizado
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ======= SAVE BUTTON ======= */}
      <div className="sticky bottom-6 flex justify-end pb-4">
        <button 
          onClick={saveConfigToServer}
          className="flex items-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-8 py-4 rounded-2xl transition-all shadow-lg hover:shadow-xl hover:scale-105 duration-300"
        >
          <Save className="h-5 w-5" /> Guardar Toda la Configuración
        </button>
      </div>
    </div>
  );
}
