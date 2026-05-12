'use client';

import { useState, useEffect } from 'react';
import { Save, Globe, Phone, Mail, MapPin, Type, FileText, Loader2, CheckCircle } from 'lucide-react';
import { useConfig } from '@/contexts/ConfigContext';
import api from '@/lib/api';

type Tab = 'hero' | 'contacto' | 'legal' | 'footer';

export default function LandingConfigPage() {
  const { config } = useConfig();
  const [activeTab, setActiveTab] = useState<Tab>('hero');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Hero
  const [heroTitulo1, setHeroTitulo1] = useState('');
  const [heroTitulo2, setHeroTitulo2] = useState('');
  const [heroSubtitulo, setHeroSubtitulo] = useState('');

  // Contacto
  const [telefono, setTelefono] = useState('');
  const [telefonoSub, setTelefonoSub] = useState('');
  const [email, setEmail] = useState('');
  const [emailSub, setEmailSub] = useState('');
  const [oficina, setOficina] = useState('');
  const [oficinaSub, setOficinaSub] = useState('');

  // Footer
  const [footerTexto, setFooterTexto] = useState('');

  // Legal
  const [legalTerminos, setLegalTerminos] = useState('');
  const [legalPrivacidad, setLegalPrivacidad] = useState('');
  const [legalDatos, setLegalDatos] = useState('');

  useEffect(() => {
    if (config) {
      setHeroTitulo1(config.landing_hero_titulo1 || 'Transporte Seguro,');
      setHeroTitulo2(config.landing_hero_titulo2 || 'Personal Capacitado');
      setHeroSubtitulo(config.landing_hero_subtitulo || '');
      setTelefono(config.landing_telefono || '');
      setTelefonoSub(config.landing_telefono_sub || '');
      setEmail(config.landing_email || '');
      setEmailSub(config.landing_email_sub || '');
      setOficina(config.landing_oficina || '');
      setOficinaSub(config.landing_oficina_sub || '');
      setFooterTexto(config.landing_footer_texto || '');
      setLegalTerminos(config.legal_terminos || '');
      setLegalPrivacidad(config.legal_privacidad || '');
      setLegalDatos(config.legal_datos || '');
    }
  }, [config]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await api.post('/configuracion', {
        landing_hero_titulo1: heroTitulo1,
        landing_hero_titulo2: heroTitulo2,
        landing_hero_subtitulo: heroSubtitulo,
        landing_telefono: telefono,
        landing_telefono_sub: telefonoSub,
        landing_email: email,
        landing_email_sub: emailSub,
        landing_oficina: oficina,
        landing_oficina_sub: oficinaSub,
        landing_footer_texto: footerTexto,
        legal_terminos: legalTerminos,
        legal_privacidad: legalPrivacidad,
        legal_datos: legalDatos,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      console.error('Error saving landing config:', err);
    } finally {
      setSaving(false);
    }
  };

  const tabs: { id: Tab; label: string; icon: React.ElementType }[] = [
    { id: 'hero', label: 'Hero', icon: Type },
    { id: 'contacto', label: 'Contacto', icon: Phone },
    { id: 'legal', label: 'Legal', icon: FileText },
    { id: 'footer', label: 'Footer', icon: Globe },
  ];

  const inputClass =
    'w-full bg-muted/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm transition-all';
  const labelClass = 'block text-sm font-bold mb-2 text-foreground';
  const fieldGroup = 'space-y-1.5';

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Globe className="h-5 w-5 text-primary" />
            </div>
            Landing Page
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Personaliza el contenido de la página principal y los textos legales. Los cambios se reflejan en tiempo
            real.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-6 py-3 rounded-xl font-bold hover:bg-primary/90 transition-all disabled:opacity-50 shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30"
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : saved ? (
            <CheckCircle className="h-4 w-4" />
          ) : (
            <Save className="h-4 w-4" />
          )}
          {saving ? 'Guardando...' : saved ? '¡Guardado!' : 'Guardar Cambios'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 bg-muted/30 p-1.5 rounded-2xl border border-border/50 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 min-w-fit flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 ${
              activeTab === tab.id
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <tab.icon className="h-4 w-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 animate-in fade-in duration-300">
        {activeTab === 'hero' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Type className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Sección Principal (Hero)</h2>
            </div>
            <p className="text-sm text-muted-foreground -mt-4 mb-6">
              Personaliza los títulos y subtítulo que aparecen al entrar a la landing page.
            </p>

            <div className={fieldGroup}>
              <label className={labelClass}>Título Línea 1</label>
              <input
                type="text"
                value={heroTitulo1}
                onChange={(e) => setHeroTitulo1(e.target.value)}
                className={inputClass}
                placeholder="Ej: Transporte Seguro,"
              />
            </div>

            <div className={fieldGroup}>
              <label className={labelClass}>Título Línea 2 (resaltado en color)</label>
              <input
                type="text"
                value={heroTitulo2}
                onChange={(e) => setHeroTitulo2(e.target.value)}
                className={inputClass}
                placeholder="Ej: Personal Capacitado"
              />
            </div>

            <div className={fieldGroup}>
              <label className={labelClass}>Subtítulo / Descripción</label>
              <textarea
                value={heroSubtitulo}
                onChange={(e) => setHeroSubtitulo(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Descripción breve de la plataforma..."
              />
            </div>

            {/* Preview */}
            <div className="mt-6 p-6 rounded-2xl bg-muted/30 border border-border/30">
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">Vista Previa</p>
              <h3 className="text-2xl font-black">{heroTitulo1}</h3>
              <h3 className="text-2xl font-black text-primary">{heroTitulo2}</h3>
              <p className="text-sm text-muted-foreground mt-2">{heroSubtitulo}</p>
            </div>
          </div>
        )}

        {activeTab === 'contacto' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Phone className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Información de Contacto</h2>
            </div>
            <p className="text-sm text-muted-foreground -mt-4 mb-6">
              Datos de contacto que se muestran en la sección &quot;Contáctanos&quot; de la landing page.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={fieldGroup}>
                <label className={labelClass}>
                  <Phone className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
                  Teléfono
                </label>
                <input
                  type="text"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value)}
                  className={inputClass}
                  placeholder="+57 300 123 4567"
                />
              </div>
              <div className={fieldGroup}>
                <label className={labelClass}>Horario de Atención</label>
                <input
                  type="text"
                  value={telefonoSub}
                  onChange={(e) => setTelefonoSub(e.target.value)}
                  className={inputClass}
                  placeholder="Lun-Vie 8am-6pm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={fieldGroup}>
                <label className={labelClass}>
                  <Mail className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
                  Email
                </label>
                <input
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="contacto@empresa.com"
                />
              </div>
              <div className={fieldGroup}>
                <label className={labelClass}>Nota de Email</label>
                <input
                  type="text"
                  value={emailSub}
                  onChange={(e) => setEmailSub(e.target.value)}
                  className={inputClass}
                  placeholder="Respuesta en 24h"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={fieldGroup}>
                <label className={labelClass}>
                  <MapPin className="h-3.5 w-3.5 inline mr-1.5 text-primary" />
                  Ciudad / Ubicación
                </label>
                <input
                  type="text"
                  value={oficina}
                  onChange={(e) => setOficina(e.target.value)}
                  className={inputClass}
                  placeholder="Bogotá, Colombia"
                />
              </div>
              <div className={fieldGroup}>
                <label className={labelClass}>Dirección Completa</label>
                <input
                  type="text"
                  value={oficinaSub}
                  onChange={(e) => setOficinaSub(e.target.value)}
                  className={inputClass}
                  placeholder="Cra 7 #45-21, Oficina 302"
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'legal' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <FileText className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Textos Legales</h2>
            </div>
            <p className="text-sm text-muted-foreground -mt-4 mb-6">
              Edita los textos que aparecen en la página <strong>/legal</strong>. Si los dejas vacíos, se usará un texto
              por defecto.
            </p>

            <div className={fieldGroup}>
              <label className={labelClass}>Términos de Uso</label>
              <textarea
                value={legalTerminos}
                onChange={(e) => setLegalTerminos(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={6}
                placeholder="Escribe aquí los términos de uso de la plataforma..."
              />
            </div>

            <div className={fieldGroup}>
              <label className={labelClass}>Política de Privacidad</label>
              <textarea
                value={legalPrivacidad}
                onChange={(e) => setLegalPrivacidad(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={6}
                placeholder="Escribe aquí la política de privacidad..."
              />
            </div>

            <div className={fieldGroup}>
              <label className={labelClass}>Protección de Datos (Habeas Data)</label>
              <textarea
                value={legalDatos}
                onChange={(e) => setLegalDatos(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={6}
                placeholder="Escribe aquí la política de protección de datos..."
              />
            </div>
          </div>
        )}

        {activeTab === 'footer' && (
          <div className="space-y-6">
            <div className="flex items-center gap-3 mb-2">
              <Globe className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-bold">Pie de Página (Footer)</h2>
            </div>
            <p className="text-sm text-muted-foreground -mt-4 mb-6">
              Texto descriptivo que aparece en la parte inferior de la landing page.
            </p>

            <div className={fieldGroup}>
              <label className={labelClass}>Texto del Footer</label>
              <textarea
                value={footerTexto}
                onChange={(e) => setFooterTexto(e.target.value)}
                className={`${inputClass} resize-none`}
                rows={3}
                placeholder="Plataforma líder en capacitación y certificación..."
              />
            </div>

            {/* Preview */}
            <div className="mt-6 p-6 rounded-2xl bg-muted/30 border border-border/30">
              <p className="text-xs font-bold text-muted-foreground mb-3 uppercase tracking-wider">
                Vista Previa del Footer
              </p>
              <p className="text-sm text-muted-foreground">{footerTexto || 'Sin texto configurado'}</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
