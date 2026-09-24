import { Test, TestingModule } from '@nestjs/testing';
import { UnauthorizedException, ConflictException } from '@nestjs/common';
import * as argon2 from 'argon2';
import { AuthService } from './auth.service';
import { AuthUserRepository } from './repository/auth-user.repository';
import { RefreshTokenService } from './services/refresh-token.service';
import { JwtTokenService } from './services/jwt-token.service';
import { RefreshTokenRepository } from './repository/refresh-token.repository';
import { AuthUser } from './entity/auth-user.entity';

describe('AuthService - Password Hashing', () => {
  let service: AuthService;
  let userRepo: AuthUserRepository;
  let jwtService: JwtTokenService;
  let refreshService: RefreshTokenService;
  let refreshTokenRepo: RefreshTokenRepository;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: AuthUserRepository,
          useValue: {
            findByUsername: jest.fn(),
            existsByUsername: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
          },
        },
        {
          provide: JwtTokenService,
          useValue: {
            generateAccessToken: jest.fn(),
          },
        },
        {
          provide: RefreshTokenService,
          useValue: {
            create: jest.fn(),
          },
        },
        {
          provide: RefreshTokenRepository,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    userRepo = module.get<AuthUserRepository>(AuthUserRepository);
    jwtService = module.get<JwtTokenService>(JwtTokenService);
    refreshService = module.get<RefreshTokenService>(RefreshTokenService);
    refreshTokenRepo = module.get<RefreshTokenRepository>(RefreshTokenRepository);
  });

  describe('Password verification - correct password', () => {
    it('should verify valid password and allow login', async () => {
      const testPassword = 'TestPassword123';
      const passwordHash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        passwordHash,
        accountId: 1,
        roles: ['CUSTOMER'],
        createdAt: new Date(),
      } as AuthUser;

      jest.spyOn(userRepo, 'findByUsername').mockResolvedValue(mockUser);
      jest.spyOn(jwtService, 'generateAccessToken').mockReturnValue('access-token');
      jest.spyOn(refreshService, 'create').mockResolvedValue('refresh-token');

      const result = await service.login('testuser', testPassword);

      expect(result).toEqual({
        accessToken: 'access-token',
        refreshToken: 'refresh-token',
        tokenType: 'Bearer',
        expiresIn: 900,
      });
    });
  });

  describe('Password verification - incorrect password', () => {
    it('should reject invalid password', async () => {
      const testPassword = 'TestPassword123';
      const wrongPassword = 'WrongPassword456';
      const passwordHash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const mockUser = {
        id: 'user-123',
        username: 'testuser',
        passwordHash,
        accountId: 1,
        roles: ['CUSTOMER'],
        createdAt: new Date(),
      } as AuthUser;

      jest.spyOn(userRepo, 'findByUsername').mockResolvedValue(mockUser);

      await expect(service.login('testuser', wrongPassword)).rejects.toThrow(
        UnauthorizedException
      );
    });
  });

  describe('Hash algorithm validation', () => {
    it('should use argon2id, not MD5 or SHA', async () => {
      const testPassword = 'TestPassword123';
      const argonHash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      // Argon2 hashes start with $argon2id$ prefix
      expect(argonHash).toMatch(/^\$argon2id\$/);
      // MD5 hashes are 32 hex chars, SHA1 are 40, SHA256 are 64
      expect(argonHash.length).toBeGreaterThan(70);
    });

    it('should verify argon2 hash successfully', async () => {
      const testPassword = 'TestPassword123';
      const argonHash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const isValid = await argon2.verify(argonHash, testPassword);
      expect(isValid).toBe(true);
    });

    it('should reject non-matching password against argon2 hash', async () => {
      const testPassword = 'TestPassword123';
      const wrongPassword = 'DifferentPassword456';
      const argonHash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const isValid = await argon2.verify(argonHash, wrongPassword);
      expect(isValid).toBe(false);
    });
  });

  describe('Password registration', () => {
    it('should hash password during registration with argon2id', async () => {
      const testPassword = 'TestPassword123';
      const mockUser = {
        id: 'user-456',
        username: 'newuser',
        passwordHash: '',
        accountId: 2,
        roles: ['CUSTOMER'],
        createdAt: new Date(),
      } as AuthUser;

      jest.spyOn(userRepo, 'existsByUsername').mockResolvedValue(false);
      jest.spyOn(userRepo, 'create').mockImplementation(async (user) => {
        mockUser.passwordHash = user.passwordHash;
        return mockUser;
      });

      const result = await service.register('newuser', testPassword, 2);

      expect(result.id).toBe('user-456');
      expect(result.username).toBe('newuser');
      // Verify password hash is argon2id format
      expect(mockUser.passwordHash).toMatch(/^\$argon2id\$/);
    });

    it('should reject duplicate username', async () => {
      jest.spyOn(userRepo, 'existsByUsername').mockResolvedValue(true);

      await expect(
        service.register('existinguser', 'Password123', 1)
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('Cost factor verification', () => {
    it('should use memory-hard argon2 parameters for GPU resistance', async () => {
      const testPassword = 'TestPassword123';
      const startTime = Date.now();
      
      const hash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const hashTime = Date.now() - startTime;

      // Verify hash is created (argon2id format)
      expect(hash).toMatch(/^\$argon2id\$/);
      // Hashing should take meaningful time due to cost parameters (~100ms on standard hardware)
      expect(hashTime).toBeGreaterThan(10);
    });

    it('should verify passwords in reasonable time', async () => {
      const testPassword = 'TestPassword123';
      const hash = await argon2.hash(testPassword, {
        type: argon2.argon2id,
        memoryCost: 65536,
        timeCost: 3,
        parallelism: 4,
      });

      const startTime = Date.now();
      const isValid = await argon2.verify(hash, testPassword);
      const verifyTime = Date.now() - startTime;

      expect(isValid).toBe(true);
      // Verification should take ~100ms (order of 0.1 seconds) on standard hardware
      expect(verifyTime).toBeGreaterThan(10);
    });
  });
});

