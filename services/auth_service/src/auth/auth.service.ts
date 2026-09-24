import {
    Injectable,
    UnauthorizedException,
    Logger,
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



@Injectable()
export class AuthService {


    private readonly logger =
        new Logger(AuthService.name);
   
    private readonly DUMMY_HASH = 
        '$argon2id$v=19$m=65536,t=3,p=4$' +
        'Z29vZGJhZHBhc3N3b3Jk$' +
        'Z29vZGJhZHBhc3N3b3Jk';

    // Login throttle configuration
    private readonly LOGIN_ATTEMPT_LIMIT = 5;
    private readonly LOGIN_THROTTLE_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
    private readonly loginAttempts = new Map<string, { count: number; firstAttempt: number }>();

    constructor(

        private userRepo: AuthUserRepository,

        private jwtService: JwtTokenService,

        private refreshService: RefreshTokenService,

        private refreshTokenRepo: RefreshTokenRepository

    ) { 
        // Clean up expired throttle entries periodically
        setInterval(() => {
            const now = Date.now();
            for (const [username, data] of this.loginAttempts.entries()) {
                if (now - data.firstAttempt > this.LOGIN_THROTTLE_WINDOW_MS) {
                    this.loginAttempts.delete(username);
                }
            }
        }, this.LOGIN_THROTTLE_WINDOW_MS);
    }

    private isThrottled(username: string): boolean {
        const attempt = this.loginAttempts.get(username);
        if (!attempt) return false;

        const now = Date.now();
        const windowExpired = now - attempt.firstAttempt > this.LOGIN_THROTTLE_WINDOW_MS;

        if (windowExpired) {
            this.loginAttempts.delete(username);
            return false;
        }

        return attempt.count >= this.LOGIN_ATTEMPT_LIMIT;
    }

    private recordFailedAttempt(username: string): void {
        const now = Date.now();
        const attempt = this.loginAttempts.get(username);

        if (!attempt) {
            this.loginAttempts.set(username, { count: 1, firstAttempt: now });
        } else {
            const windowExpired = now - attempt.firstAttempt > this.LOGIN_THROTTLE_WINDOW_MS;
            if (windowExpired) {
                // Reset the window
                this.loginAttempts.set(username, { count: 1, firstAttempt: now });
            } else {
                // Increment within the same window
                attempt.count++;
            }
        }
    }

    private clearLoginAttempts(username: string): void {
        this.loginAttempts.delete(username);
    }




    async login(username: string, password: string) {

        this.logger.log(
            `[AUTH_EVENT] login_attempt_started username=${username}`
        );

        // Check if username is throttled
        if (this.isThrottled(username)) {
            this.logger.warn(
                `[AUTH_EVENT] login_rejected_throttled username=${username}`
            );
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        const user =
            await this.userRepo.findByUsername(username);
        
        const passwordHashToVerify = user ? user.passwordHash : this.DUMMY_HASH;

        const valid =
            await argon2.verify(
                passwordHashToVerify,
                password
            );

        // Both paths (user found or not) now take the same time due to argon2 verification
        if (!user || !valid) {

            this.recordFailedAttempt(username);

            if (!user) {
                this.logger.warn(
                    `[AUTH_EVENT] login_rejected_user_not_found username=${username}`
                );
            } else {
                this.logger.warn(
                    `[AUTH_EVENT] login_rejected_invalid_password username=${username} userId=${user.id}`
                );
            }

            throw new UnauthorizedException({

                errorCode: "AUTH-401",

                message: "Unauthorised"

            });

        }

        // Password is valid and user exists
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

        // Clear failed attempts on successful login
        this.clearLoginAttempts(username);

        this.logger.log(
            `[AUTH_EVENT] login_succeeded userId=${user.id} accountId=${user.accountId} roles=${user.roles.join(',')}`
        );

        return {

            accessToken,

            refreshToken,

            tokenType: "Bearer",

            expiresIn: 900

        };

    }

    async register(username: string, password: string, accountId: number, roles?: string[]) {
        this.logger.log(
            `[AUTH_EVENT] register_attempt_started username=${username} accountId=${accountId}`
        );

        // Check if username already exists
        const exists = await this.userRepo.existsByUsername(username);
        if (exists) {
            this.logger.warn(
                `[AUTH_EVENT] register_rejected_duplicate_username username=${username}`
            );
            throw new ConflictException({
                errorCode: 'AUTH-409',
                message: 'Registration failed',
            });
        }

        // Hash the password with argon2
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
            this.logger.log(
                `[AUTH_EVENT] register_succeeded userId=${savedUser.id} username=${username} accountId=${accountId}`
            );

            return {
                id: savedUser.id,
                username: savedUser.username,
                accountId: savedUser.accountId,
                roles: savedUser.roles,
                createdOn: new Date().toISOString(),
            };
        } catch (error) {
            this.logger.error(
                `[AUTH_EVENT] register_failed_database_error username=${username} error=${error}`
            );
            throw new ConflictException({
                errorCode: 'AUTH-409',
                message: 'Registration failed',
            });
        }
    }

    async refresh(refreshToken: string) {
        this.logger.log(
            `[AUTH_EVENT] refresh_attempt_started`
        );

        // Find and verify the refresh token
        const tokenRecord = await this.refreshTokenRepo.verifyAndFindToken(refreshToken);
        
        if (!tokenRecord) {
            this.logger.warn(
                `[AUTH_EVENT] refresh_rejected_token_not_found`
            );
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Check if token has been consumed
        if (tokenRecord.consumedAt) {
            this.logger.error(
                `[AUTH_EVENT] refresh_rejected_token_reuse userId=${tokenRecord.userId}`
            );
            // Token reuse detected - revoke all tokens for this user
            await this.refreshTokenRepo.revokeAllUserTokens(tokenRecord.userId);
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Check if token has been revoked
        if (tokenRecord.revokedAt) {
            this.logger.warn(
                `[AUTH_EVENT] refresh_rejected_token_revoked userId=${tokenRecord.userId}`
            );
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        // Check if token has expired
        if (new Date() > tokenRecord.expiresAt) {
            this.logger.warn(
                `[AUTH_EVENT] refresh_rejected_token_expired userId=${tokenRecord.userId}`
            );
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
            this.logger.error(
                `[AUTH_EVENT] refresh_failed_user_not_found userId=${tokenRecord.userId}`
            );
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

        this.logger.log(
            `[AUTH_EVENT] refresh_succeeded userId=${user.id} accountId=${user.accountId}`
        );

        return {
            accessToken,
            refreshToken: newRefreshToken,
            tokenType: 'Bearer',
            expiresIn: 900,
        };
    }

    async getCurrentUser(userId: string) {
        this.logger.log(
            `[AUTH_EVENT] get_current_user_started userId=${userId}`
        );

        const user = await this.userRepo.findById(userId);
        if (!user) {
            this.logger.warn(
                `[AUTH_EVENT] get_current_user_rejected_user_not_found userId=${userId}`
            );
            throw new UnauthorizedException({
                errorCode: 'AUTH-401',
                message: 'Unauthorised',
            });
        }

        this.logger.log(
            `[AUTH_EVENT] get_current_user_succeeded userId=${userId}`
        );

        return {
            id: user.id,
            username: user.username,
            accountId: user.accountId,
            roles: user.roles,
            createdOn: new Date().toISOString(),
        };
    }

}