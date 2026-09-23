import {
    Controller,
    Post,
    Body
} from '@nestjs/common';


import {
    AuthService
} from './auth.service';


import {
    LoginRequestDto
} from './dto/login-request.dto';



@Controller("auth")
export class AuthController {


    constructor(
        private service: AuthService
    ) { }



    @Post("login")
    login(
        @Body() dto: LoginRequestDto
    ) {

        return this.service.login(
            dto.username,
            dto.password
        );

    }


}