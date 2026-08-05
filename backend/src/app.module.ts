import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule, TypeOrmModuleOptions } from '@nestjs/typeorm';
import { MasterDataModule } from './modules/master-data/master-data.module';
import { InvoicesModule } from './modules/invoices/invoices.module';
import { DevinModule } from './modules/devin/devin.module';
import { ReportsModule } from './modules/reports/reports.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService): TypeOrmModuleOptions => ({
        type: 'postgres',
        host: configService.get<string>('DB_HOST', 'localhost'),
        port: Number(configService.get<string>('DB_PORT', '5432')),
        username: configService.get<string>('DB_USERNAME', 'postgres'),
        password: configService.get<string>('DB_PASSWORD', 'postgres'),
        database: configService.get<string>('DB_DATABASE', 'procurement'),
        entities: [__dirname + '/**/*.entity{.ts,.js}'],
        synchronize: configService.get<string>('DB_SYNCHRONIZE', 'true') !== 'false',
        logging: configService.get<string>('DB_LOGGING', 'false') === 'true',
      }),
      inject: [ConfigService],
    }),
    MasterDataModule,
    InvoicesModule,
    ReportsModule,
    DevinModule,
  ],
})
export class AppModule {}
