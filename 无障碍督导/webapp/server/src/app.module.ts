import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { config } from './config';
import { ALL_ENTITIES } from './database/entities';
import { JwtGuard } from './common/jwt.guard';
import { RolesGuard } from './common/roles.guard';
import { StorageModule } from './storage/storage.module';
import { SeedModule } from './seed/seed.module';
import { AuthModule } from './modules/auth/auth.module';
import { OrgsModule } from './modules/orgs/orgs.module';
import { UsersModule } from './modules/users/users.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { PointsModule } from './modules/points/points.module';
import { TasksModule } from './modules/tasks/tasks.module';
import { InspectionsModule } from './modules/inspections/inspections.module';
import { IssuesModule } from './modules/issues/issues.module';
import { FilesModule } from './modules/files/files.module';
import { ChecklibModule } from './modules/checklib/checklib.module';
import { StatsModule } from './modules/stats/stats.module';
import { AdminModule } from './modules/admin/admin.module';

const dbOptions: DataSourceOptions =
  config.dbType === 'postgres'
    ? {
        type: 'postgres',
        host: config.pg.host,
        port: config.pg.port,
        username: config.pg.username,
        password: config.pg.password,
        database: config.pg.database,
        entities: ALL_ENTITIES,
        synchronize: true, // 一期开发阶段：实体即 schema
      }
    : {
        type: 'better-sqlite3',
        database: config.sqlitePath,
        entities: ALL_ENTITIES,
        synchronize: true,
      };

@Module({
  imports: [
    TypeOrmModule.forRoot(dbOptions),
    JwtModule.register({
      global: true,
      secret: config.jwtSecret,
      signOptions: { expiresIn: config.jwtExpiresIn },
    }),
    StorageModule,
    SeedModule,
    AuthModule,
    OrgsModule,
    UsersModule,
    CampaignsModule,
    PointsModule,
    TasksModule,
    InspectionsModule,
    IssuesModule,
    FilesModule,
    ChecklibModule,
    StatsModule,
    AdminModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
})
export class AppModule {}
