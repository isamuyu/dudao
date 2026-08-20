import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OrgEntity, UserEntity } from '../../database/entities';
import { OrgsService } from './orgs.service';
import { OrgsController } from './orgs.controller';

@Module({
  imports: [TypeOrmModule.forFeature([OrgEntity, UserEntity])],
  providers: [OrgsService],
  controllers: [OrgsController],
})
export class OrgsModule {}
