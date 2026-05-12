import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UserService } from './user.service';
import { PrismaModule } from '../prisma/prisma.module';
import { TokenBlacklistService } from './token-blacklist.service';
import { StorageModule } from '../storage/storage.module';

@Module({
  imports: [PrismaModule, StorageModule],
  controllers: [AuthController],
  providers: [AuthService, UserService, TokenBlacklistService],
  exports: [TokenBlacklistService, UserService],
})
export class AuthModule {}
