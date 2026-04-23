"use strict";
Object.defineProperty(exports, "__esModule", {
    value: true
});
const _core = require("@nestjs/core");
const _platformfastify = require("@nestjs/platform-fastify");
const _appmodule = require("./app.module");
const _common = require("@nestjs/common");
const _swagger = require("@nestjs/swagger");
const _config = require("@nestjs/config");
async function bootstrap() {
    const app = await _core.NestFactory.create(_appmodule.AppModule, new _platformfastify.FastifyAdapter({
        bodyLimit: 10485760
    }) // 10MB for base64 file uploads
    );
    const configService = app.get(_config.ConfigService);
    app.setGlobalPrefix('api');
    app.useGlobalPipes(new _common.ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true
    }));
    app.enableCors({
        origin: true,
        methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
        credentials: true
    });
    const config = new _swagger.DocumentBuilder().setTitle('Enterprise LMS API').setDescription('LMS Backend API').setVersion('1.0').addBearerAuth().build();
    const document = _swagger.SwaggerModule.createDocument(app, config);
    _swagger.SwaggerModule.setup('docs', app, document);
    const port = process.env.APP_PORT || 3200;
    await app.listen(port);
    console.log(`LMS API running on http://localhost:${port}/api`);
}
bootstrap();

//# sourceMappingURL=main.js.map