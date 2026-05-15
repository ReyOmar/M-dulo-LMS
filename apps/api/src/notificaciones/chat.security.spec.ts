import { ChatService } from './chat.service';

/**
 * F5.7/F5.8: Security tests for ChatService.
 * Validates:
 * - F2.9: Contact request requires both users in the course
 * - F2.10: Conversation deletion is unilateral (own messages only)
 * - F4.7: Messaging requires approved contact relationship
 * - Offline recipient email notification
 */
describe('ChatService — Security', () => {
  let service: ChatService;
  let mockPrisma: any;

  const mockGateway: any = {
    broadcast: jest.fn(),
    isUserOnline: jest.fn().mockReturnValue(true), // Default: user is online (no email sent)
  };
  const mockNotificaciones: any = { crearNotificacion: jest.fn().mockResolvedValue({}) };
  const mockMailService: any = { sendChatNotification: jest.fn().mockResolvedValue(true) };

  beforeEach(() => {
    mockPrisma = {
      lms_cursos: { findUnique: jest.fn() },
      lms_matriculas: { findUnique: jest.fn(), findMany: jest.fn() },
      lms_contacto_chat: {
        findFirst: jest.fn(),
        create: jest.fn(),
        findMany: jest.fn(),
      },
      lms_mensajes: {
        create: jest.fn(),
        deleteMany: jest.fn(),
        updateMany: jest.fn(),
      },
      usuarios: { findUnique: jest.fn(), findMany: jest.fn() },
    };
    service = new ChatService(mockPrisma, mockGateway, mockNotificaciones, mockMailService);
    // Reset mocks between tests
    jest.clearAllMocks();
    // Default: user is online
    mockGateway.isUserOnline.mockReturnValue(true);
  });

  // ── F2.9: Contact request — both users must be in the course ──

  describe('solicitarContacto — F2.9', () => {
    it('should ALLOW contact request when both users are in the course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({ profesor_guid: 'prof-1' });
      // Solicitante is enrolled, receptor is the professor
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue({
        usuario_guid: 'student-1',
        curso_guid: 'curso-1',
      });
      mockPrisma.lms_contacto_chat.findFirst.mockResolvedValue(null);
      mockPrisma.lms_contacto_chat.create.mockResolvedValue({
        id: 1,
        solicitante_guid: 'student-1',
        receptor_guid: 'prof-1',
        estado: 'PENDIENTE',
      });

      const result = await service.solicitarContacto('student-1', 'prof-1', 'curso-1');
      expect(result.estado).toBe('PENDIENTE');
    });

    it('should DENY when solicitante is NOT in the course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({ profesor_guid: 'prof-1' });
      // Solicitante is not enrolled and not the professor
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(service.solicitarContacto('outsider', 'prof-1', 'curso-1')).rejects.toThrow(
        'No perteneces a este curso.',
      );
    });

    it('should DENY when receptor is NOT in the course', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue({ profesor_guid: 'prof-1' });
      // Solicitante IS the professor, receptor is not enrolled
      mockPrisma.lms_matriculas.findUnique.mockResolvedValue(null);

      await expect(service.solicitarContacto('prof-1', 'outsider', 'curso-1')).rejects.toThrow(
        'El usuario no pertenece a este curso.',
      );
    });

    it('should DENY when course does not exist', async () => {
      mockPrisma.lms_cursos.findUnique.mockResolvedValue(null);

      await expect(service.solicitarContacto('student-1', 'prof-1', 'nonexistent')).rejects.toThrow(
        'Curso no encontrado.',
      );
    });
  });

  // ── F2.10: Unilateral conversation deletion ──

  describe('eliminarConversacion — F2.10', () => {
    it('should only delete messages SENT BY the requesting user', async () => {
      mockPrisma.lms_mensajes.deleteMany.mockResolvedValue({ count: 5 });

      await service.eliminarConversacion('user-A', 'user-B');

      // Verify the WHERE clause targets remitente_guid = user-A only
      expect(mockPrisma.lms_mensajes.deleteMany).toHaveBeenCalledWith({
        where: {
          remitente_guid: 'user-A',
          destinatario_guid: 'user-B',
        },
      });
    });

    it('should NOT delete messages sent by the other user', async () => {
      mockPrisma.lms_mensajes.deleteMany.mockResolvedValue({ count: 3 });

      await service.eliminarConversacion('user-A', 'user-B');

      // The delete should NOT include user-B's messages to user-A
      const call = mockPrisma.lms_mensajes.deleteMany.mock.calls[0][0];
      expect(call.where.remitente_guid).toBe('user-A');
      expect(call.where.remitente_guid).not.toBe('user-B');
    });
  });

  // ── F4.7: Messaging requires approved contact ──

  describe('enviarMensaje — F4.7', () => {
    it('should DENY messaging without approved contact', async () => {
      // No contact found — and sender is not admin
      mockPrisma.lms_contacto_chat.findFirst.mockResolvedValue(null);
      mockPrisma.usuarios.findUnique.mockResolvedValue({ rol: 'ESTUDIANTE' });

      await expect(
        service.enviarMensaje({
          remitente_guid: 'user-A',
          destinatario_guid: 'user-B',
          asunto: 'Hi',
          contenido: 'Hello',
        }),
      ).rejects.toThrow();
    });

    it('should ALLOW messaging with accepted contact', async () => {
      // SEC: The actual domain state uses 'ACEPTADO' not 'APROBADO'
      mockPrisma.lms_contacto_chat.findFirst.mockResolvedValue({
        id: 1,
        estado: 'ACEPTADO',
      });
      mockPrisma.lms_mensajes.create.mockResolvedValue({
        id: 1,
        remitente_guid: 'user-A',
        destinatario_guid: 'user-B',
        created_at: new Date(),
      });
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Test', apellido: 'User' });

      const result = await service.enviarMensaje({
        remitente_guid: 'user-A',
        destinatario_guid: 'user-B',
        asunto: 'Hi',
        contenido: 'Hello',
      });
      expect(result).toBeDefined();
    });

    it('should send email when recipient is offline', async () => {
      mockPrisma.lms_contacto_chat.findFirst.mockResolvedValue({
        id: 1,
        estado: 'ACEPTADO',
      });
      mockPrisma.lms_mensajes.create.mockResolvedValue({
        id: 1,
        remitente_guid: 'user-A',
        destinatario_guid: 'user-B',
        created_at: new Date(),
      });
      // Sender lookup for notification
      mockPrisma.usuarios.findUnique
        .mockResolvedValueOnce({ nombre: 'Sender', apellido: 'User' }) // remitente lookup
        .mockResolvedValueOnce({ email: 'dest@example.com', nombre: 'Dest' }); // destinatario lookup

      // Recipient is OFFLINE
      mockGateway.isUserOnline.mockReturnValue(false);

      await service.enviarMensaje({
        remitente_guid: 'user-A',
        destinatario_guid: 'user-B',
        asunto: 'Hi',
        contenido: 'Hello',
      });

      // Verify email was triggered for offline user
      expect(mockMailService.sendChatNotification).toHaveBeenCalled();
    });

    it('should NOT send email when recipient is online', async () => {
      mockPrisma.lms_contacto_chat.findFirst.mockResolvedValue({
        id: 1,
        estado: 'ACEPTADO',
      });
      mockPrisma.lms_mensajes.create.mockResolvedValue({
        id: 1,
        remitente_guid: 'user-A',
        destinatario_guid: 'user-B',
        created_at: new Date(),
      });
      mockPrisma.usuarios.findUnique.mockResolvedValue({ nombre: 'Test', apellido: 'User' });

      // Recipient is ONLINE
      mockGateway.isUserOnline.mockReturnValue(true);

      await service.enviarMensaje({
        remitente_guid: 'user-A',
        destinatario_guid: 'user-B',
        asunto: 'Hi',
        contenido: 'Hello',
      });

      // Email should NOT be sent to online users
      expect(mockMailService.sendChatNotification).not.toHaveBeenCalled();
    });
  });
});
