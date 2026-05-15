import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';

const mockPrisma = {
  $queryRaw: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [{ provide: PrismaService, useValue: mockPrisma }],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  it('should return healthy when DB is connected', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);

    const result = await controller.check();

    expect(result.status).toBe('healthy');
    expect(result.database.status).toBe('ok');
    expect(result.database.latencyMs).toBeDefined();
    expect(result.timestamp).toBeDefined();
    // SEC: Verify we do NOT expose sensitive system info
    expect((result as any).memory).toBeUndefined();
    expect((result as any).uptime).toBeUndefined();
    expect((result as any).storage).toBeUndefined();
    expect((result as any).environment).toBeUndefined();
    expect((result as any).version).toBeUndefined();
  });

  it('should return degraded when DB fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.database.status).toBe('error');
    expect(result.database.latencyMs).toBeNull();
  });
});
