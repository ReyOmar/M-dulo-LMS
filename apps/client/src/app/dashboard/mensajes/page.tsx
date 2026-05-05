"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { MessageSquare, Send, ArrowLeft, Search, X, User, Clock, Check, Loader2, Inbox } from "lucide-react";
import { useRole } from "@/contexts/RoleContext";
import { useWS } from "@/contexts/WebSocketContext";
import api from "@/lib/api";
import { PageLoader } from "@/components/ui/PageLoader";

interface Contact {
  guid: string;
  nombre: string;
  apellido: string;
  rol: string;
  ultimo_mensaje: string;
  ultimo_mensaje_fecha: string;
  no_leidos: number;
}

interface Message {
  id: number;
  contenido: string;
  asunto: string;
  created_at: string;
  remitente: {
    guid: string;
    nombre: string;
    apellido: string;
    rol: string;
  };
}

export default function MensajesPage() {
  const { user } = useRole();
  const { subscribe } = useWS();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedContact, setSelectedContact] = useState<Contact | null>(null);
  const [loading, setLoading] = useState(true);
  const [msgLoading, setMsgLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newMsg, setNewMsg] = useState("");
  const [sending, setSending] = useState(false);
  
  // New conversation state
  const [showNewChat, setShowNewChat] = useState(false);
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [userSearch, setUserSearch] = useState("");

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchContacts = useCallback(async () => {
    try {
      const res = await api.get('/notificaciones/mensajes-contactos');
      setContacts(res.data || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContacts();
  }, [fetchContacts]);

  // Listen for new messages in real-time
  useEffect(() => {
    if (!user?.guid) return;
    const unsub = subscribe('message:new', (data: any) => {
      // Refresh contacts list
      fetchContacts();
      // If we're in the conversation with the sender, add the message
      if (selectedContact && data.remitente_guid === selectedContact.guid) {
        setMessages(prev => [...prev, {
          id: data.id,
          contenido: data.contenido,
          asunto: data.asunto,
          created_at: data.created_at,
          remitente: {
            guid: data.remitente_guid,
            nombre: data.remitente_nombre?.split(' ')[0] || '',
            apellido: data.remitente_nombre?.split(' ').slice(1).join(' ') || '',
            rol: '',
          },
        }]);
        // Mark as read
        api.patch(`/notificaciones/mensajes/${data.remitente_guid}/leer`).catch(() => {});
      }
    });
    return () => unsub();
  }, [user?.guid, subscribe, selectedContact, fetchContacts]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const openConversation = async (contact: Contact) => {
    setSelectedContact(contact);
    setMsgLoading(true);
    try {
      const res = await api.get(`/notificaciones/mensajes/${contact.guid}`);
      setMessages(res.data || []);
      // Mark messages as read
      await api.patch(`/notificaciones/mensajes/${contact.guid}/leer`);
      setContacts(prev => prev.map(c => c.guid === contact.guid ? { ...c, no_leidos: 0 } : c));
    } catch (err) {
      console.error(err);
    } finally {
      setMsgLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMsg.trim() || !selectedContact || sending) return;
    setSending(true);
    try {
      await api.post('/notificaciones/mensajes', {
        destinatario_guid: selectedContact.guid,
        asunto: 'Mensaje',
        contenido: newMsg.trim(),
      });
      // Add locally immediately for responsiveness
      setMessages(prev => [...prev, {
        id: Date.now(),
        contenido: newMsg.trim(),
        asunto: 'Mensaje',
        created_at: new Date().toISOString(),
        remitente: {
          guid: user?.guid || '',
          nombre: user?.nombre || '',
          apellido: user?.apellido || '',
          rol: '',
        },
      }]);
      setNewMsg("");
      fetchContacts();
    } catch (err) {
      console.error(err);
    } finally {
      setSending(false);
    }
  };

  const startNewConversation = async () => {
    setShowNewChat(true);
    try {
      // Fetch available users based on role
      const endpoint = user?.role === 'ESTUDIANTE' ? '/cursos/profesores' : '/cursos/estudiantes';
      const res = await api.get(endpoint);
      setAvailableUsers(res.data || []);
    } catch {}
  };

  const selectNewContact = (u: any) => {
    const contact: Contact = {
      guid: u.guid,
      nombre: u.nombre,
      apellido: u.apellido,
      rol: '',
      ultimo_mensaje: '',
      ultimo_mensaje_fecha: new Date().toISOString(),
      no_leidos: 0,
    };
    setSelectedContact(contact);
    setMessages([]);
    setShowNewChat(false);
    // Add to contacts if not already there
    if (!contacts.find(c => c.guid === u.guid)) {
      setContacts(prev => [contact, ...prev]);
    }
  };

  const filteredContacts = contacts.filter(c =>
    `${c.nombre} ${c.apellido}`.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = availableUsers.filter(u =>
    `${u.nombre} ${u.apellido} ${u.email}`.toLowerCase().includes(userSearch.toLowerCase()) &&
    !contacts.find(c => c.guid === u.guid)
  );

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    if (diff < 86400000) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    if (diff < 604800000) return d.toLocaleDateString('es-ES', { weekday: 'short' });
    return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' });
  };

  const getRoleColor = (rol: string) => {
    if (rol === 'PROFESOR') return 'bg-blue-500';
    if (rol === 'ESTUDIANTE') return 'bg-emerald-500';
    if (rol === 'ADMINISTRADOR') return 'bg-red-500';
    return 'bg-primary';
  };

  if (loading) return <PageLoader message="Cargando mensajes..." />;

  return (
    <div className="animate-in fade-in duration-500 h-[calc(100vh-6rem)]">
      <header className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight flex items-center gap-3">
          <MessageSquare className="h-8 w-8 text-primary" />
          Mensajes
        </h1>
        <p className="text-muted-foreground mt-1.5">Comunicación directa entre examinadores y personal en capacitación.</p>
      </header>

      <div className="flex gap-0 h-[calc(100vh-14rem)] bg-card border border-border rounded-2xl overflow-hidden shadow-sm">
        {/* Contacts List */}
        <div className={`w-full md:w-[340px] border-r border-border flex flex-col shrink-0 ${selectedContact ? 'hidden md:flex' : 'flex'}`}>
          {/* Search + New */}
          <div className="p-4 border-b border-border/50 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar contacto..."
                className="w-full bg-muted/50 border-0 rounded-xl pl-10 pr-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
              />
            </div>
            <button
              onClick={startNewConversation}
              className="w-full bg-primary text-white rounded-xl py-2.5 text-sm font-bold hover:bg-primary/90 transition-colors flex items-center justify-center gap-2"
            >
              <MessageSquare className="h-4 w-4" /> Nueva Conversación
            </button>
          </div>

          {/* New Chat: User Selection */}
          {showNewChat && (
            <div className="p-3 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-muted-foreground uppercase">Seleccionar usuario</span>
                <button onClick={() => setShowNewChat(false)} className="p-1 hover:bg-muted rounded-lg">
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              </div>
              <input
                type="text"
                value={userSearch}
                onChange={e => setUserSearch(e.target.value)}
                placeholder="Buscar por nombre o email..."
                className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 mb-2"
              />
              <div className="max-h-48 overflow-y-auto space-y-1">
                {filteredUsers.length === 0 ? (
                  <p className="text-xs text-muted-foreground text-center py-3">No se encontraron usuarios.</p>
                ) : (
                  filteredUsers.map(u => (
                    <button
                      key={u.guid}
                      onClick={() => selectNewContact(u)}
                      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                      <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {u.nombre?.charAt(0)}{u.apellido?.charAt(0)}
                      </div>
                      <div className="truncate">
                        <p className="text-sm font-medium truncate">{u.nombre} {u.apellido}</p>
                        <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Contact List */}
          <div className="flex-1 overflow-y-auto">
            {filteredContacts.length === 0 && !showNewChat ? (
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground p-6">
                <Inbox className="h-10 w-10 opacity-20 mb-3" />
                <p className="text-sm font-medium">Sin conversaciones</p>
                <p className="text-xs text-center mt-1">Inicia una nueva conversación con el botón de arriba.</p>
              </div>
            ) : (
              filteredContacts.map(c => (
                <button
                  key={c.guid}
                  onClick={() => openConversation(c)}
                  className={`w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left border-b border-border/30 ${
                    selectedContact?.guid === c.guid ? 'bg-primary/5 border-l-2 border-l-primary' : ''
                  }`}
                >
                  <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${getRoleColor(c.rol)}`}>
                    {c.nombre?.charAt(0)}{c.apellido?.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-sm truncate">{c.nombre} {c.apellido}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0 ml-2">{formatTime(c.ultimo_mensaje_fecha)}</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5">{c.ultimo_mensaje}</p>
                  </div>
                  {c.no_leidos > 0 && (
                    <span className="bg-primary text-white text-[10px] font-bold h-5 min-w-[20px] px-1.5 rounded-full flex items-center justify-center shrink-0">
                      {c.no_leidos}
                    </span>
                  )}
                </button>
              ))
            )}
          </div>
        </div>

        {/* Conversation Area */}
        <div className={`flex-1 flex flex-col ${!selectedContact ? 'hidden md:flex' : 'flex'}`}>
          {!selectedContact ? (
            <div className="flex-1 flex items-center justify-center text-muted-foreground">
              <div className="text-center">
                <MessageSquare className="h-14 w-14 mx-auto mb-4 opacity-10" />
                <p className="font-medium">Selecciona una conversación</p>
                <p className="text-sm mt-1 opacity-70">o inicia una nueva para comenzar.</p>
              </div>
            </div>
          ) : (
            <>
              {/* Conversation Header */}
              <div className="h-16 px-5 flex items-center gap-3 border-b border-border/50 shrink-0 bg-muted/10">
                <button
                  onClick={() => setSelectedContact(null)}
                  className="md:hidden p-2 hover:bg-muted rounded-lg transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className={`h-9 w-9 rounded-full flex items-center justify-center text-white font-bold text-sm shrink-0 ${getRoleColor(selectedContact.rol)}`}>
                  {selectedContact.nombre?.charAt(0)}{selectedContact.apellido?.charAt(0)}
                </div>
                <div>
                  <p className="font-bold text-sm">{selectedContact.nombre} {selectedContact.apellido}</p>
                  <p className="text-xs text-muted-foreground">
                    {selectedContact.rol === 'PROFESOR' ? 'Examinador' : selectedContact.rol === 'ESTUDIANTE' ? 'En Capacitación' : 'Usuario'}
                  </p>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {msgLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : messages.length === 0 ? (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    <div className="text-center">
                      <MessageSquare className="h-10 w-10 mx-auto mb-3 opacity-10" />
                      <p className="text-sm">Envía el primer mensaje.</p>
                    </div>
                  </div>
                ) : (
                  messages.map(m => {
                    const isMine = m.remitente.guid === user?.guid;
                    return (
                      <div key={m.id} className={`flex ${isMine ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${
                          isMine
                            ? 'bg-primary text-primary-foreground rounded-br-md'
                            : 'bg-muted rounded-bl-md'
                        }`}>
                          <p className="text-sm whitespace-pre-wrap break-words">{m.contenido}</p>
                          <p className={`text-[10px] mt-1.5 flex items-center gap-1 ${isMine ? 'text-primary-foreground/60 justify-end' : 'text-muted-foreground'}`}>
                            {new Date(m.created_at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
                            {isMine && <Check className="h-3 w-3" />}
                          </p>
                        </div>
                      </div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input */}
              <div className="p-4 border-t border-border/50 shrink-0">
                <div className="flex items-center gap-3">
                  <input
                    type="text"
                    value={newMsg}
                    onChange={e => setNewMsg(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !e.shiftKey && sendMessage()}
                    placeholder="Escribe un mensaje..."
                    className="flex-1 bg-muted/50 border border-border rounded-xl px-4 py-3 focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
                    disabled={sending}
                  />
                  <button
                    onClick={sendMessage}
                    disabled={!newMsg.trim() || sending}
                    className="h-11 w-11 bg-primary text-white rounded-xl flex items-center justify-center hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                  >
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
