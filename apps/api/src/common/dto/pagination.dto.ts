import { IsOptional, IsInt, Min, Max, IsString } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * F9.3: Reusable pagination DTO.
 * Apply to any list endpoint to limit unbounded queries.
 * Default: page=1, limit=25, max=100.
 */
export class PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 25;

  @IsOptional()
  @IsString()
  search?: string;

  /** Computed skip value for Prisma */
  get skip(): number {
    return ((this.page ?? 1) - 1) * (this.limit ?? 25);
  }

  /** Computed take value for Prisma */
  get take(): number {
    return this.limit ?? 25;
  }
}
