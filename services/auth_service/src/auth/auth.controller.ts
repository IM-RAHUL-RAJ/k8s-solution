import {
    Controller,
    Post,
    Body,
    UseGuards,
    Get,
    HttpCode,
    HttpStatus
} from '@nestjs/common';


import {
    AuthService
} from './auth.service';

import { RedactedLogger } from '../common/redacted-logger';


import {
    LoginRequestDto
} from './dto/login-request.dto';
import { RegisterRequestDto } from './dto/register-request.dto';
import { RefreshRequestDto } from './dto/refresh-request.dto';
import { JwtPayload } from './types/jwt-payload';
import { CurrentUser } from './decorator/current-user.decorator';
import { JwtAuthGuard } from './guards/jwt-auth.guard';



@Controller("auth")
export class AuthController {


    private readonly logger =
        new RedactedLogger(AuthController.name);


    constructor(
        private service: AuthService
    ) { }

    @Post("register")
    @HttpCode(HttpStatus.CREATED)
    register(
        @Body() dto: RegisterRequestDto
    ) {
        this.logger.log(
            `[AUTH_EVENT] register_request_received username=${dto.username} accountId=${dto.accountId}`
        );

        // Do not log the password; log a redacted confirmation instead
        this.logger.logRedacted(`[AUTH_EVENT] register_request_received_hashed_password`, {
            username: dto.username,
            password: dto.password,
        });

        return this.service.register(
            dto.username,
            dto.password,
            dto.accountId,
            dto.roles
        );
    }

    @Post("login")
    @HttpCode(HttpStatus.OK)
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

    @Post('refresh')
    @HttpCode(HttpStatus.OK)
    refresh(
        @Body() dto: RefreshRequestDto
    ) {
        this.logger.log(
            `[AUTH_EVENT] refresh_request_received`
        );

        return this.service.refresh(
            dto.refreshToken
        );
    }

    @Get('me')
    @UseGuards(JwtAuthGuard)
    me(
        @CurrentUser() user: JwtPayload,
    ) {
        this.logger.log(
            `[AUTH_EVENT] me_request_received userId=${user.sub}`
        );

        return this.service.getCurrentUser(user.sub);
    }

}