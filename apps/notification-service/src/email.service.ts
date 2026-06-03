import { Injectable } from '@nestjs/common';
import nodemailer from 'nodemailer';
import { createLogger } from '@ride-hailing/shared-utils';

@Injectable()
export class EmailService {
    private readonly logger = createLogger('notification-service');
    private readonly configured = Boolean(
        process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS,
    );
    private readonly transport = this.configured
        ? nodemailer.createTransport({
              host: process.env.SMTP_HOST,
              port: Number(process.env.SMTP_PORT || 587),
              secure: false,
              auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
          })
        : undefined;

    async send(to: string, subject: string, templateName: string, data: Record<string, unknown>) {
        const html = this.render(templateName, data);
        if (!this.transport) {
            this.logger.info('smtp_not_configured_email_logged', { to, subject, html });
            return;
        }
        await this.transport.sendMail({ from: process.env.SMTP_USER, to, subject, html });
    }

    private render(templateName: string, data: Record<string, unknown>) {
        const value = (primary: string, fallback?: string): string =>
            this.escape(String(data[primary] ?? (fallback ? data[fallback] : '') ?? ''));
        const body =
            {
                ride_requested: 'Your ride has been requested, finding you a driver...',
                ride_driver_matched: `Driver ${value('driverName')} is on the way! ETA: ${value('eta', 'estimatedArrivalMinutes')} minutes`,
                ride_completed: `Your ride is complete. Fare: ${value('fare', 'finalFare')} BDT. Thank you!`,
                ride_cancelled: `Your ride was cancelled. Reason: ${value('reason')}`,
                payment_failed: 'Payment failed for your ride. Please try again.',
            }[templateName] || JSON.stringify(data);
        return `<div style="font-family:Arial,sans-serif"><header style="background:#111827;color:white;padding:16px"><h1>Ride Hailing</h1></header><main style="padding:16px"><p>${body}</p></main><footer style="color:#6b7280;padding:16px">Thanks for riding with us.</footer></div>`;
    }

    private escape(value: string): string {
        return value
            .replaceAll('&', '&amp;')
            .replaceAll('<', '&lt;')
            .replaceAll('>', '&gt;')
            .replaceAll('"', '&quot;')
            .replaceAll("'", '&#39;');
    }
}
