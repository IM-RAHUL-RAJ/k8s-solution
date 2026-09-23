import {
    Controller,
    Post,
    Body,
    Logger
} from '@nestjs/common';


import {
    AuthService
} from './auth.service';


import {
    LoginRequestDto
} from './dto/login-request.dto';



@Controller("auth")
export class AuthController {


    private readonly logger =
        new Logger(AuthController.name);


    constructor(
        private service: AuthService
    ) { }



    @Post("login")
    login(
        @Body() dto: LoginRequestDto
    ) {

        this.logger.log(
            `[AUTH_EVENT] login_request_received username=${dto.username}`
        );

        return this.service.login(
            dto.username,
            dto.password
        );

    }


}