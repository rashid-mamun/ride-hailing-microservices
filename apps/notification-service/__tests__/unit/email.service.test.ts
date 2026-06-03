import nodemailer from 'nodemailer';
import { EmailService } from '../../src/email.service';

const sendMail = jest.fn();

jest.mock('nodemailer', () => ({
    __esModule: true,
    default: {
        createTransport: jest.fn(() => ({ sendMail })),
    },
}));

describe('EmailService', () => {
    const env = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...env };
        delete process.env.SMTP_HOST;
        delete process.env.SMTP_USER;
        delete process.env.SMTP_PASS;
        delete process.env.SMTP_PORT;
    });

    afterAll(() => {
        process.env = env;
    });

    it('logs email content and does not crash when SMTP is not configured', async () => {
        const service = new EmailService();

        await expect(
            service.send('rider@example.com', 'Ride requested', 'ride_requested', {}),
        ).resolves.toBeUndefined();
        expect(nodemailer.createTransport).not.toHaveBeenCalled();
        expect(sendMail).not.toHaveBeenCalled();
    });

    it('sends templated email through SMTP when configured', async () => {
        process.env.SMTP_HOST = 'smtp.example.com';
        process.env.SMTP_PORT = '587';
        process.env.SMTP_USER = 'user@example.com';
        process.env.SMTP_PASS = 'secret';
        sendMail.mockResolvedValueOnce({ accepted: ['rider@example.com'] });

        const service = new EmailService();
        await service.send('rider@example.com', 'Driver matched', 'ride_driver_matched', {
            driverName: 'Jane',
            eta: 4,
        });

        expect(nodemailer.createTransport).toHaveBeenCalledWith({
            host: 'smtp.example.com',
            port: 587,
            secure: false,
            auth: { user: 'user@example.com', pass: 'secret' },
        });
        expect(sendMail).toHaveBeenCalledWith(
            expect.objectContaining({
                from: 'user@example.com',
                to: 'rider@example.com',
                subject: 'Driver matched',
                html: expect.stringContaining('Driver Jane is on the way'),
            }),
        );
    });
});
