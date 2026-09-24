import {
    Injectable,
    UnauthorizedException,
    ConflictException,
    BadRequestException
} from '@nestjs/common';


import * as argon2 from 'argon2';

import { AuthUserRepository }
    from './repository/auth-user.repository';

import { RefreshTokenService }
    from './services/refresh-token.service';

import { JwtTokenService }
    from './services/jwt-token.service';

import { AuthUser } from './entity/auth-user.entity';
import { RefreshTokenRepository } from './repository/refresh-token.repository';
import { RedactedLogger } from '../common/redacted-logger';



@Injectable()
export class AuthService {


    private readonly logger =
        new RedactedLogger(AuthService.name);


    constructor(

        private userRepo: AuthUserRepository,

        private jwtService: JwtTokenService,

        private refreshService: RefreshTokenService,

        private refreshTokenRepo: RefreshTokenRepository

    ) { }




    async login(username: string, password: string) {

        // Log attempt with redaction-capable logger
        this.logger.logRedacted('[AUTH_EVENT] login_attempt_started', { username });


        const user =
            await this.userRepo.findByUsername(username);



        if (!user) {

            this.logger.warnRedacted('[AUTH_EVENT] login_rejected_user_not_found', { username });

            throw new UnauthorizedException({

                errorCode: "AUTH-401",

                message: "Unauthorised"

            });

        }



        const valid = await argon2.verify(user.passwordHash, password);



        if (!valid) {

            this.logger.warnRedacted('[AUTH_EVENT] login_rejected_invalid_password', { username, userId: user.id });

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


        this.logger.logRedacted('[AUTH_EVENT] login_succeeded', { userId: user.id, accountId: user.accountId, roles: user.roles });

        return {

            accessToken,

            refreshToken,

            tokenType: "Bearer",

            expiresIn: 900

        };

    }

    async register(username: string, password: string, accountId: number, roles?: string[]) {
        this.logger.logRedacted('[AUTH_EVENT] register_attempt_started', { username, accountId });

        // Check if username already exists
        const exists = await this.userRepo.existsByUsername(username);
        if (exists) {
            this.logger.warnRedacted('[AUTH_EVENT] register_rejected_duplicate_username', { username });
            throw new ConflictException({
                errorCode: 'AUTH-409',
                message: 'Registration failed',
            });
        }

        // Hash the password with argon2
        // Argon2id: memory-hard to resist GPU attacks. Cost: ~100ms verification on standard hardware.
        const passwordHash = await argon2.hash(password, {
            type: argon2.argon2id,
            memoryCost: 65536,
            timeCost: 3,
            parallelism: 4,
        });

        // Create the user entity
        const authUser = new AuthUser();
        authUser.username = username;
        authUser.passwordHash = passwordHash;
        authUser.accountId = accountId;
        authUser.roles = roles && roles.length > 0 ? roles : ['CUSTOMER'];

        try {
            const savedUser = await this.userRepo.create(authUser);
            this.logger.logRedacted('[AUTH_EVENT] register_succeeded', { userId: savedUser.id, username, accountId });

            return {
                id: savedUser.id,
                username: savedUser.username,
                accountId: savedUser.accountId,
                roles: savedUser.roles,
                createdOn: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.errorRedacted('[AUTH_EVENT] register_failed_database_error', { username, error });
            throw new ConflictException({
                errorCode: 'AUTH-409',
                message: 'Registration failed',
            });
        }
    }

    async refresh(refreshToken: string) {
        this.logger.logRedacted('[AUTH_EVENT] refresh_attempt_started');

        // Find and verify the refresh token
        const tokenRecord = await this.refreshTokenRepo.verifyAndFindToken(refreshToken);
        
        if (!tokenRecord) {
            this.logger.warnRedacted('[AUTH_EVENT] refresh_rejected_token_not_found');
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Check if token has been consumed
        if (tokenRecord.consumedAt) {
            this.logger.errorRedacted('[AUTH_EVENT] refresh_rejected_token_reuse', { userId: tokenRecord.userId });
            // Token reuse detected - revoke all tokens for this user
            await this.refreshTokenRepo.revokeAllUserTokens(tokenRecord.userId);
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Check if token has been revoked
        if (tokenRecord.revokedAt) {
            this.logger.warnRedacted('[AUTH_EVENT] refresh_rejected_token_revoked', { userId: tokenRecord.userId });
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Check if token has expired
        if (new Date() > tokenRecord.expiresAt) {
            this.logger.warnRedacted('[AUTH_EVENT] refresh_rejected_token_expired', { userId: tokenRecord.userId });
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Mark the old token as consumed
        await this.refreshTokenRepo.markAsConsumed(tokenRecord.id);

        // Get the user details
        const user = await this.userRepo.findById(tokenRecord.userId);
        if (!user) {
            this.logger.errorRedacted('[AUTH_EVENT] refresh_failed_user_not_found', { userId: tokenRecord.userId });
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Generate new tokens
        const accessToken = this.jwtService.generateAccessToken(
            user.id,
            user.accountId,
            user.roles
        );

        const newRefreshToken = await this.refreshService.create(user.id);

        this.logger.logRedacted('[AUTH_EVENT] refresh_succeeded', { userId: user.id, accountId: user.accountId });

        return {
            accessToken,
            refreshToken: newRefreshToken,
            tokenType: 'Bearer',
            expiresIn: 900,
        };
    }

    async getCurrentUser(userId: string) {
        this.logger.logRedacted('[AUTH_EVENT] get_current_user_started', { userId });

        const user = await this.userRepo.findById(userId);
        if (!user) {
            this.logger.warnRedacted('[AUTH_EVENT] get_current_user_rejected_user_not_found', { userId });
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        this.logger.logRedacted('[AUTH_EVENT] get_current_user_succeeded', { userId });

        return {
            id: user.id,
            username: user.username,
            accountId: user.accountId,
            roles: user.roles,
            createdOn: new Date().toISOString(),
        };
    }

}