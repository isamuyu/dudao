import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgEntity, UserEntity } from '../../database/entities';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';

@Module({
  imports: [TypeOrmModule.forFeature([UserEntity, OrgEntity])],
  providers: [AuthService],
  controllers: [AuthController],
})
export class AuthModule {}
