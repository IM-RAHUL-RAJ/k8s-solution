import { Module } from '@nestjs/common';

import { ConfigModule, ConfigService } from '@nestjs/config';

import { TypeOrmModule } from '@nestjs/typeorm';


import { AuthModule } from './auth/auth.module';


import { AuthUser } from './auth/entity/auth-user.entity';
import { RefreshToken } from './auth/entity/refresh-token.entity';



@Module({

imports:[


ConfigModule.forRoot({
    isGlobal:true
}),



TypeOrmModule.forRootAsync({

imports:[
    ConfigModule
],


inject:[
    ConfigService
],


useFactory:(config:ConfigService)=>({

    type:'postgres',

    host:config.get('DB_HOST'),

    port:
    Number(config.get('DB_PORT')),

    username:
    config.get('DB_USERNAME'),

    password:
    config.get('DB_PASSWORD'),

    database:
    config.get('DB_NAME'),


    entities:[
        AuthUser,
        RefreshToken
    ],


    synchronize:false

}),


}),



AuthModule


]

})
export class AppModule {}