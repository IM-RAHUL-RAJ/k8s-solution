import {
    Injectable,
    UnauthorizedException
} from '@nestjs/common';


import * as argon2 from 'argon2';


import { AuthUserRepository }
    from './repository/auth-user.repository';


import { RefreshTokenService }
    from './services/refresh-token.service';


import { JwtTokenService }
    from './services/jwt-token.service';



@Injectable()
export class AuthService {


    constructor(

        private userRepo: AuthUserRepository,

        private jwtService: JwtTokenService,

        private refreshService: RefreshTokenService

    ) { }




    async login(username: string, password: string) {


        const user =
            await this.userRepo.findByUsername(username);



        if (!user) {

            throw new UnauthorizedException({

                errorCode: "AUTH-401",

                message: "Unauthorised"

            });

        }



        const valid =
            await argon2.verify(
                user.passwordHash,
                password
            );



        if (!valid) {

            throw new UnauthorizedException({

                errorCode: "AUTH-401",

                message: "Unauthorised"

            });

        }




        const accessToken =
            this.jwtService.generateAccessToken(

                user.id,

                user.accountId,

                user.roles

            );



        const refreshToken =
            await this.refreshService.create(
                user.id
            );



        return {

            accessToken,

            refreshToken,

            tokenType: "Bearer",

            expiresIn: 900

        };


    }


}