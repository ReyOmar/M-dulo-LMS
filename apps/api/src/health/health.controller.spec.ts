import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';

const mockPrisma = {
  $queryRaw: jest.fn(),
};

const mockConfig = {
  get: jest.fn(),
};

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: PrismaService, useValue: mockPrisma },
        { provide: ConfigService, useValue: mockConfig },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    jest.clearAllMocks();
  });

  it('should return healthy when DB is connected', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    mockConfig.get.mockReturnValue(null);

    const result = await controller.check();

    expect(result.status).toBe('healthy');
    expect(result.database.status).toBe('ok');
    expect(result.database.latencyMs).toBeDefined();
    expect(result.uptime.seconds).toBeGreaterThanOrEqual(0);
    expect(result.uptime.human).toBeDefined();
    expect(result.memory.rss).toContain('MB');
    expect(result.timestamp).toBeDefined();
    expect(result.storage).toBe('local');
  });

  it('should return degraded when DB fails', async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error('Connection refused'));
    mockConfig.get.mockReturnValue(null);

    const result = await controller.check();

    expect(result.status).toBe('degraded');
    expect(result.database.status).toBe('error');
  });

  it('should detect cloudflare-r2 storage when R2_ENDPOINT is set', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ 1: 1 }]);
    mockConfig.get.mockReturnValue('https://r2.example.com');

    const result = await controller.check();

    expect(result.storage).toBe('cloudflare-r2');
  });
});
