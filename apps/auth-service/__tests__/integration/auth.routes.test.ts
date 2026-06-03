import { INestApplication, ValidationPipe, type ExecutionContext } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AuthController } from '../../src/auth.controller';
import { AuthService } from '../../src/auth.service';
import { JwtAuthGuard } from '../../src/jwt-auth.guard';

describe('Auth routes', () => {
    let app: INestApplication;
    const authService = {
        register: jest.fn(),
        login: jest.fn(),
        refreshToken: jest.fn(),
        logout: jest.fn(),
        me: jest.fn(),
        updateMe: jest.fn(),
        setAvailability: jest.fn(),
    };

    beforeEach(async () => {
        jest.clearAllMocks();
        const moduleRef = await Test.createTestingModule({
            controllers: [AuthController],
            providers: [{ provide: AuthService, useValue: authService }],
        })
            .overrideGuard(JwtAuthGuard)
            .useValue({
                canActivate: (context: ExecutionContext) => {
                    const request = context.switchToHttp().getRequest<{
                        path?: string;
                        user?: { sub: string; email: string; role: string };
                    }>();
                    const isDriverRoute = request.path?.includes('/drivers/availability');
                    request.user = {
                        sub: 'user-1',
                        email: isDriverRoute ? 'driver@example.com' : 'rider@example.com',
                        role: isDriverRoute ? 'driver' : 'rider',
                    };
                    return true;
                },
            })
            .compile();

        app = moduleRef.createNestApplication();
        app.useGlobalPipes(
            new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
        );
        await app.init();
    });

    afterEach(async () => {
        await app.close();
    });

    it('registers and logs in through HTTP response envelope', async () => {
        authService.register.mockResolvedValue({
            accessToken: 'a',
            refreshToken: 'r',
            user: { id: 'user-1' },
        });
        authService.login.mockResolvedValue({
            accessToken: 'a',
            refreshToken: 'r',
            user: { id: 'user-1' },
        });

        await request(app.getHttpServer())
            .post('/api/auth/register')
            .send({
                email: 'RIDER@example.com',
                password: 'StrongPass123',
                firstName: 'John',
                lastName: 'Doe',
                role: 'rider',
            })
            .expect(201)
            .expect(({ body }) =>
                expect(body).toMatchObject({ success: true, data: { accessToken: 'a' } }),
            );

        await request(app.getHttpServer())
            .post('/api/auth/login')
            .send({ email: 'rider@example.com', password: 'StrongPass123' })
            .expect(201)
            .expect(({ body }) => expect(body.success).toBe(true));
    });

    it('rejects invalid registration payloads at validation layer', async () => {
        await request(app.getHttpServer())
            .post('/api/auth/register')
            .send({
                email: 'not-email',
                password: 'weak',
                firstName: 'John',
                lastName: 'Doe',
                role: 'rider',
                extra: 'blocked',
            })
            .expect(400);

        expect(authService.register).not.toHaveBeenCalled();
    });

    it('refreshes, logs out, returns profile and updates availability routes', async () => {
        authService.refreshToken.mockResolvedValue({ accessToken: 'new' });
        authService.logout.mockResolvedValue({ loggedOut: true });
        authService.me.mockResolvedValue({ id: 'user-1', email: 'rider@example.com' });
        authService.updateMe.mockResolvedValue({ id: 'user-1', firstName: 'Jane' });
        authService.setAvailability.mockResolvedValue({ isAvailable: true });

        await request(app.getHttpServer())
            .post('/api/auth/refresh')
            .send({ refreshToken: 'r' })
            .expect(201)
            .expect(({ body }) => expect(body.data.accessToken).toBe('new'));
        await request(app.getHttpServer())
            .post('/api/auth/logout')
            .send({ refreshToken: 'r' })
            .expect(201)
            .expect(({ body }) => expect(body.data.loggedOut).toBe(true));
        await request(app.getHttpServer())
            .get('/api/auth/me')
            .set('Authorization', 'Bearer token')
            .expect(200)
            .expect(({ body }) => expect(body.data.id).toBe('user-1'));
        await request(app.getHttpServer())
            .patch('/api/auth/me')
            .set('Authorization', 'Bearer token')
            .send({ firstName: 'Jane' })
            .expect(200)
            .expect(({ body }) => expect(body.data.firstName).toBe('Jane'));
        await request(app.getHttpServer())
            .put('/api/auth/drivers/availability')
            .set('Authorization', 'Bearer token')
            .send({ isAvailable: true })
            .expect(200)
            .expect(({ body }) => expect(body.data.isAvailable).toBe(true));
    });
});
