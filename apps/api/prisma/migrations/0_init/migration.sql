-- CreateTable
CREATE TABLE `usuarios` (
    `guid` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `contrasena` VARCHAR(191) NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `rol` ENUM('ADMINISTRADOR', 'PROFESOR', 'ESTUDIANTE') NOT NULL DEFAULT 'ESTUDIANTE',
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `ultimo_acceso` DATETIME(3) NULL,
    `usa_clave_defecto` BOOLEAN NOT NULL DEFAULT true,
    `firma_url` VARCHAR(191) NULL,
    `firma_nombre` VARCHAR(191) NULL,
    `firma_cargo` VARCHAR(191) NULL,

    UNIQUE INDEX `usuarios_email_key`(`email`),
    PRIMARY KEY (`guid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_solicitudes_acceso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `nombre` VARCHAR(191) NOT NULL,
    `apellido` VARCHAR(191) NOT NULL,
    `rol_pedido` ENUM('ADMINISTRADOR', 'PROFESOR', 'ESTUDIANTE') NOT NULL,
    `estado` ENUM('PENDIENTE', 'ACEPTADA', 'RECHAZADA') NOT NULL DEFAULT 'PENDIENTE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lms_solicitudes_acceso_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_cursos` (
    `guid` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` TEXT NULL,
    `descripcion_corta` VARCHAR(191) NULL,
    `imagen_portada` VARCHAR(191) NULL,
    `nivel` ENUM('PRINCIPIANTE', 'INTERMEDIO', 'AVANZADO', 'EXPERTO') NOT NULL DEFAULT 'PRINCIPIANTE',
    `estado` ENUM('BORRADOR', 'PUBLICADO', 'ARCHIVADO') NOT NULL DEFAULT 'BORRADOR',
    `duracion_horas` INTEGER NULL,
    `fecha_inicio` DATETIME(3) NULL,
    `fecha_fin` DATETIME(3) NULL,
    `codigo_acceso` VARCHAR(191) NULL,
    `max_estudiantes` INTEGER NULL,
    `escala` ENUM('NUMERICA', 'PORCENTAJE', 'PUNTOS', 'LETRAS') NOT NULL DEFAULT 'NUMERICA',
    `nota_aprobacion` DECIMAL(65, 30) NOT NULL DEFAULT 3.0,
    `orden_estricto` BOOLEAN NOT NULL DEFAULT true,
    `emite_certificado` BOOLEAN NOT NULL DEFAULT true,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,
    `profesor_guid` VARCHAR(191) NOT NULL,

    UNIQUE INDEX `lms_cursos_codigo_acceso_key`(`codigo_acceso`),
    INDEX `lms_cursos_profesor_guid_idx`(`profesor_guid`),
    PRIMARY KEY (`guid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_modulos` (
    `guid` VARCHAR(191) NOT NULL,
    `curso_guid` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `requiere_anterior` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `lms_modulos_curso_guid_idx`(`curso_guid`),
    PRIMARY KEY (`guid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_lecciones` (
    `guid` VARCHAR(191) NOT NULL,
    `modulo_guid` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `lms_lecciones_modulo_guid_idx`(`modulo_guid`),
    PRIMARY KEY (`guid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_recursos` (
    `guid` VARCHAR(191) NOT NULL,
    `leccion_guid` VARCHAR(191) NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `tipo` ENUM('TEXTO', 'VIDEO', 'PDF', 'ENLACE', 'TAREA') NOT NULL,
    `contenido_html` TEXT NULL,
    `url_archivo` VARCHAR(191) NULL,
    `url_referencia` VARCHAR(191) NULL,
    `archivo_adjunto` LONGTEXT NULL,
    `archivo_adjunto_nombre` VARCHAR(191) NULL,
    `archivo_max_size_mb` INTEGER NULL,
    `quiz_config` TEXT NULL,
    `orden` INTEGER NOT NULL DEFAULT 0,
    `obligatorio` BOOLEAN NOT NULL DEFAULT true,
    `tiempo_lectura` INTEGER NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,
    `deleted_at` DATETIME(3) NULL,

    INDEX `lms_recursos_leccion_guid_idx`(`leccion_guid`),
    PRIMARY KEY (`guid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_entregas` (
    `guid` VARCHAR(191) NOT NULL,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `tarea_guid` VARCHAR(191) NULL,
    `url_archivo_adjunto` VARCHAR(191) NULL,
    `respuesta_texto` VARCHAR(191) NULL,
    `estado` ENUM('BORRADOR', 'ENTREGADA', 'ENTREGADA_TARDE', 'CALIFICADA', 'EN_REVISION') NOT NULL DEFAULT 'ENTREGADA',
    `intento_numero` INTEGER NOT NULL DEFAULT 1,
    `fecha_inicio` DATETIME(3) NULL,
    `fecha_entrega` DATETIME(3) NULL,
    `contenido_texto` TEXT NULL,
    `calificacion` DECIMAL(65, 30) NULL,
    `comentario_calificacion` TEXT NULL,
    `ip_address` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lms_entregas_usuario_guid_idx`(`usuario_guid`),
    INDEX `lms_entregas_tarea_guid_idx`(`tarea_guid`),
    INDEX `lms_entregas_tarea_guid_usuario_guid_idx`(`tarea_guid`, `usuario_guid`),
    INDEX `lms_entregas_estado_idx`(`estado`),
    PRIMARY KEY (`guid`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_progreso_recurso` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `recurso_guid` VARCHAR(191) NOT NULL,
    `completado` BOOLEAN NOT NULL DEFAULT true,
    `fecha_completado` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tiempo_invertido` INTEGER NULL,

    UNIQUE INDEX `lms_progreso_recurso_usuario_guid_recurso_guid_key`(`usuario_guid`, `recurso_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_matriculas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `curso_guid` VARCHAR(191) NOT NULL,
    `tipo` ENUM('MANUAL', 'CODIGO_ACCESO', 'SISTEMA') NOT NULL DEFAULT 'MANUAL',
    `activa` BOOLEAN NOT NULL DEFAULT true,
    `fecha_matricula` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fecha_baja` DATETIME(3) NULL,

    UNIQUE INDEX `lms_matriculas_usuario_guid_curso_guid_key`(`usuario_guid`, `curso_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_notificaciones` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `tipo` ENUM('EVALUACION_NUEVA', 'DEADLINE_PROXIMO', 'DEADLINE_URGENTE', 'TAREA_CALIFICADA', 'ANUNCIO_CURSO', 'ANUNCIO_GLOBAL', 'BIENVENIDA_CURSO', 'BADGE_DESBLOQUEADO', 'MODULO_COMPLETADO', 'MODULO_REINICIADO', 'REVISION_ENTREGA', 'ENTREGA_RECHAZADA', 'CURSO_REACTIVADO', 'RECORDATORIO_INACTIVIDAD', 'MENSAJE_NUEVO') NOT NULL,
    `titulo` VARCHAR(191) NOT NULL,
    `mensaje` VARCHAR(191) NOT NULL,
    `leida` BOOLEAN NOT NULL DEFAULT false,
    `url_accion` VARCHAR(191) NULL,
    `ref_tipo` VARCHAR(191) NULL,
    `ref_guid` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lms_notificaciones_usuario_guid_idx`(`usuario_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_mensajes` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `remitente_guid` VARCHAR(191) NOT NULL,
    `destinatario_guid` VARCHAR(191) NOT NULL,
    `asunto` VARCHAR(191) NOT NULL,
    `contenido` TEXT NOT NULL,
    `leido` BOOLEAN NOT NULL DEFAULT false,
    `ref_tipo` VARCHAR(191) NULL,
    `ref_guid` VARCHAR(191) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lms_mensajes_remitente_guid_idx`(`remitente_guid`),
    INDEX `lms_mensajes_destinatario_guid_idx`(`destinatario_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_password_resets` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `email` VARCHAR(191) NOT NULL,
    `token` VARCHAR(191) NOT NULL,
    `usado` BOOLEAN NOT NULL DEFAULT false,
    `expires_at` DATETIME(3) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lms_password_resets_token_key`(`token`),
    INDEX `lms_password_resets_email_idx`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_metricas_capacitacion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `dias_consecutivos` INTEGER NOT NULL DEFAULT 0,
    `total_horas_invertidas` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    `cursos_completados` INTEGER NOT NULL DEFAULT 0,
    `promedio_global` DECIMAL(65, 30) NOT NULL DEFAULT 0.0,
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `lms_metricas_capacitacion_usuario_guid_key`(`usuario_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_configuracion` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nombre_plataforma` VARCHAR(191) NOT NULL DEFAULT 'Campus Virtual',
    `logo_url` VARCHAR(191) NULL,
    `favicon_url` VARCHAR(191) NULL,
    `color_primario` VARCHAR(191) NOT NULL DEFAULT '#4f46e5',
    `color_secundario` VARCHAR(191) NOT NULL DEFAULT '#10b981',
    `fuente` VARCHAR(191) NOT NULL DEFAULT 'Inter',
    `border_radius` INTEGER NOT NULL DEFAULT 12,
    `login_fondo_url` VARCHAR(191) NULL,
    `mensaje_bienvenida` VARCHAR(191) NOT NULL DEFAULT 'Bienvenido PESV',
    `idioma` VARCHAR(191) NOT NULL DEFAULT 'es',
    `zona_horaria` VARCHAR(191) NOT NULL DEFAULT 'America/Bogota',
    `max_archivo_mb` INTEGER NOT NULL DEFAULT 10,
    `contrasena_defecto` VARCHAR(191) NOT NULL DEFAULT 'pesvauth2026',
    `email_remitente` VARCHAR(191) NULL,
    `email_nombre` VARCHAR(191) NULL,
    `bienvenida_html` TEXT NULL,
    `cert_titulo_personalizado` VARCHAR(191) NULL,
    `cert_subtitulo` VARCHAR(191) NULL,
    `cert_texto_legal` VARCHAR(191) NULL,
    `cert_mostrar_modulos` BOOLEAN NOT NULL DEFAULT true,
    `cert_mostrar_recursos` BOOLEAN NOT NULL DEFAULT true,
    `cert_mostrar_nota` BOOLEAN NOT NULL DEFAULT true,
    `cert_mostrar_firma` BOOLEAN NOT NULL DEFAULT true,
    `cert_mostrar_fecha_ingreso` BOOLEAN NOT NULL DEFAULT false,
    `landing_hero_titulo1` VARCHAR(191) NOT NULL DEFAULT 'Transporte Seguro,',
    `landing_hero_titulo2` VARCHAR(191) NOT NULL DEFAULT 'Personal Capacitado',
    `landing_hero_subtitulo` VARCHAR(191) NOT NULL DEFAULT 'Plataforma integral para la gestión del Plan Estratégico de Seguridad Vial. Capacitación, evaluación y certificación de conductores con tecnología de vanguardia.',
    `landing_telefono` VARCHAR(191) NOT NULL DEFAULT '+57 300 123 4567',
    `landing_telefono_sub` VARCHAR(191) NOT NULL DEFAULT 'Lun-Vie 8am-6pm',
    `landing_email` VARCHAR(191) NOT NULL DEFAULT 'contacto@pesveducation.com',
    `landing_email_sub` VARCHAR(191) NOT NULL DEFAULT 'Respuesta en 24h',
    `landing_oficina` VARCHAR(191) NOT NULL DEFAULT 'Bogotá, Colombia',
    `landing_oficina_sub` VARCHAR(191) NOT NULL DEFAULT 'Cra 7 #45-21, Oficina 302',
    `landing_footer_texto` VARCHAR(191) NOT NULL DEFAULT 'Plataforma líder en capacitación y certificación de seguridad vial para empresas de transporte de carga.',
    `legal_terminos` TEXT NULL,
    `legal_privacidad` TEXT NULL,
    `legal_datos` TEXT NULL,
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_certificados` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `guid` VARCHAR(191) NOT NULL,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `curso_guid` VARCHAR(191) NOT NULL,
    `codigo_verificacion` VARCHAR(191) NOT NULL,
    `archivo_pdf` VARCHAR(191) NOT NULL,
    `fecha_inicio` DATETIME(3) NOT NULL,
    `fecha_completado` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `tiempo_total_horas` DECIMAL(65, 30) NOT NULL DEFAULT 0,
    `tiempo_activo_seg` INTEGER NOT NULL DEFAULT 0,
    `nota_promedio` DECIMAL(65, 30) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `lms_certificados_guid_key`(`guid`),
    UNIQUE INDEX `lms_certificados_codigo_verificacion_key`(`codigo_verificacion`),
    INDEX `lms_certificados_usuario_guid_idx`(`usuario_guid`),
    INDEX `lms_certificados_curso_guid_idx`(`curso_guid`),
    UNIQUE INDEX `lms_certificados_usuario_guid_curso_guid_key`(`usuario_guid`, `curso_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_sesion_activa` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `curso_guid` VARCHAR(191) NOT NULL,
    `inicio_sesion` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `fin_sesion` DATETIME(3) NULL,
    `duracion_seg` INTEGER NOT NULL DEFAULT 0,

    INDEX `lms_sesion_activa_usuario_guid_curso_guid_idx`(`usuario_guid`, `curso_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_contacto_chat` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `solicitante_guid` VARCHAR(191) NOT NULL,
    `receptor_guid` VARCHAR(191) NOT NULL,
    `curso_guid` VARCHAR(191) NOT NULL,
    `estado` ENUM('PENDIENTE', 'ACEPTADO', 'RECHAZADO') NOT NULL DEFAULT 'PENDIENTE',
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    INDEX `lms_contacto_chat_receptor_guid_idx`(`receptor_guid`),
    INDEX `lms_contacto_chat_solicitante_guid_idx`(`solicitante_guid`),
    UNIQUE INDEX `lms_contacto_chat_solicitante_guid_receptor_guid_curso_guid_key`(`solicitante_guid`, `receptor_guid`, `curso_guid`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_token_revocations` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `usuario_guid` VARCHAR(191) NOT NULL,
    `revoked_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `expires_at` DATETIME(3) NOT NULL,

    INDEX `lms_token_revocations_usuario_guid_idx`(`usuario_guid`),
    INDEX `lms_token_revocations_expires_at_idx`(`expires_at`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_eventos_correo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `identificador` VARCHAR(191) NOT NULL,
    `nombre_legible` VARCHAR(191) NOT NULL,
    `descripcion` VARCHAR(191) NOT NULL,
    `variables` TEXT NOT NULL,

    UNIQUE INDEX `lms_eventos_correo_identificador_key`(`identificador`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lms_plantillas_correo` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `evento_id` INTEGER NOT NULL,
    `nombre_interno` VARCHAR(191) NOT NULL,
    `asunto` VARCHAR(191) NOT NULL,
    `cuerpo_html` TEXT NOT NULL,
    `activo` BOOLEAN NOT NULL DEFAULT true,
    `es_sistema` BOOLEAN NOT NULL DEFAULT false,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `lms_cursos` ADD CONSTRAINT `lms_cursos_profesor_guid_fkey` FOREIGN KEY (`profesor_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_modulos` ADD CONSTRAINT `lms_modulos_curso_guid_fkey` FOREIGN KEY (`curso_guid`) REFERENCES `lms_cursos`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_lecciones` ADD CONSTRAINT `lms_lecciones_modulo_guid_fkey` FOREIGN KEY (`modulo_guid`) REFERENCES `lms_modulos`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_recursos` ADD CONSTRAINT `lms_recursos_leccion_guid_fkey` FOREIGN KEY (`leccion_guid`) REFERENCES `lms_lecciones`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_entregas` ADD CONSTRAINT `lms_entregas_usuario_guid_fkey` FOREIGN KEY (`usuario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_entregas` ADD CONSTRAINT `lms_entregas_tarea_guid_fkey` FOREIGN KEY (`tarea_guid`) REFERENCES `lms_recursos`(`guid`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_progreso_recurso` ADD CONSTRAINT `lms_progreso_recurso_usuario_guid_fkey` FOREIGN KEY (`usuario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_progreso_recurso` ADD CONSTRAINT `lms_progreso_recurso_recurso_guid_fkey` FOREIGN KEY (`recurso_guid`) REFERENCES `lms_recursos`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_matriculas` ADD CONSTRAINT `lms_matriculas_usuario_guid_fkey` FOREIGN KEY (`usuario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_matriculas` ADD CONSTRAINT `lms_matriculas_curso_guid_fkey` FOREIGN KEY (`curso_guid`) REFERENCES `lms_cursos`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_notificaciones` ADD CONSTRAINT `lms_notificaciones_usuario_guid_fkey` FOREIGN KEY (`usuario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_mensajes` ADD CONSTRAINT `lms_mensajes_remitente_guid_fkey` FOREIGN KEY (`remitente_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_mensajes` ADD CONSTRAINT `lms_mensajes_destinatario_guid_fkey` FOREIGN KEY (`destinatario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_metricas_capacitacion` ADD CONSTRAINT `lms_metricas_capacitacion_usuario_guid_fkey` FOREIGN KEY (`usuario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_certificados` ADD CONSTRAINT `lms_certificados_usuario_guid_fkey` FOREIGN KEY (`usuario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_certificados` ADD CONSTRAINT `lms_certificados_curso_guid_fkey` FOREIGN KEY (`curso_guid`) REFERENCES `lms_cursos`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_sesion_activa` ADD CONSTRAINT `lms_sesion_activa_usuario_guid_fkey` FOREIGN KEY (`usuario_guid`) REFERENCES `usuarios`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_sesion_activa` ADD CONSTRAINT `lms_sesion_activa_curso_guid_fkey` FOREIGN KEY (`curso_guid`) REFERENCES `lms_cursos`(`guid`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lms_plantillas_correo` ADD CONSTRAINT `lms_plantillas_correo_evento_id_fkey` FOREIGN KEY (`evento_id`) REFERENCES `lms_eventos_correo`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
