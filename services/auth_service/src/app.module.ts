import { Module } from '@nestjs/common';

import {
    ConfigModule,
    ConfigService,
} from '@nestjs/config';
import { configuration } from './config/configuration';

import {
    TypeOrmModule,
} from '@nestjs/typeorm';

import { AuthModule } from './auth/auth.module';
import { HealthController } from './health/health.controller';

import { AuthUser } from './auth/entity/auth-user.entity';
import { RefreshToken } from './auth/entity/refresh-token.entity';


@Module({

    imports: [

        ConfigModule.forRoot({
            isGlobal: true,
            load: [configuration],
        }),


        TypeOrmModule.forRootAsync({

            imports: [
                ConfigModule,
            ],

            inject: [
                ConfigService,
            ],

            useFactory: (
                config: ConfigService,
            ) => ({

                type: 'postgres',

                host:
                    config.get<string>(
                        'database.host',
                    ),

                port:
                    config.get<number>(
                        'database.port',
                    ),

                username:
                    config.get<string>(
                        'database.user',
                    ),

                password:
                    config.get<string>(
                        'database.password',
                    ),

                database:
                    config.get<string>(
                        'database.database',
                    ),

                entities: [
                    AuthUser,
                    RefreshToken,
                ],

                synchronize: false,
            }),
        }),


        AuthModule,
    ],
    controllers: [HealthController],
})
export class AppModule {}