import { Injectable, NestMiddleware } from '@nestjs/common';
import axios from 'axios';
import { NextFunction, Request, Response } from 'express';
import { createCircuitBreaker, createLogger } from '@ride-hailing/shared-utils';

type Route = { prefix: string; target: string; service: string };
const routes = (): Route[] => [
    { prefix: '/api/v1/auth', target: process.env.AUTH_SERVICE_URL || '', service: 'auth' },
    { prefix: '/api/auth', target: process.env.AUTH_SERVICE_URL || '', service: 'auth' },
    { prefix: '/api/v1/rides', target: process.env.RIDE_SERVICE_URL || '', service: 'ride' },
    { prefix: '/api/rides', target: process.env.RIDE_SERVICE_URL || '', service: 'ride' },
    {
        prefix: '/api/v1/locations',
        target: process.env.LOCATION_SERVICE_URL || '',
        service: 'location',
    },
    {
        prefix: '/api/locations',
        target: process.env.LOCATION_SERVICE_URL || '',
        service: 'location',
    },
    {
        prefix: '/api/v1/pricing',
        target: process.env.PRICING_SERVICE_URL || '',
        service: 'pricing',
    },
    { prefix: '/api/pricing', target: process.env.PRICING_SERVICE_URL || '', service: 'pricing' },
];

const requestPath = (req: Request): string =>
    (req.originalUrl || req.url || req.path).split('?')[0] || '/';

@Injectable()
export class ProxyMiddleware implements NestMiddleware {
    private readonly logger = createLogger('api-gateway');
    private readonly breakers = new Map<string, ReturnType<typeof createCircuitBreaker>>();

    use(req: Request, res: Response, next: NextFunction): void {
        const path = requestPath(req);
        if (path === '/health' || path.startsWith('/api/docs')) return next();
        const route = routes().find((item) => path.startsWith(item.prefix));
        if (!route) return next();
        const breaker = this.getBreaker(route);
        breaker.fire(req, res).catch((error) => {
            this.logger.error('proxy_request_failed', {
                service: route.service,
                error: error instanceof Error ? error.message : String(error),
            });
            if (!res.headersSent) {
                res.status(503).json({
                    success: false,
                    error: 'Service temporarily unavailable',
                    service: route.service,
                });
            }
        });
    }

    private getBreaker(route: Route): ReturnType<typeof createCircuitBreaker> {
        const existing = this.breakers.get(route.service);
        if (existing) return existing;
        const breaker = createCircuitBreaker(
            async (req: Request, res: Response) => {
                const body = await this.readBody(req);
                const response = await axios.request({
                    method: req.method,
                    url: `${route.target}${req.originalUrl || req.url}`,
                    headers: this.forwardHeaders(req),
                    data: body,
                    timeout: 25000,
                    validateStatus: () => true,
                });
                for (const [header, value] of Object.entries(response.headers)) {
                    if (
                        !['connection', 'content-length', 'transfer-encoding'].includes(
                            header.toLowerCase(),
                        ) &&
                        value !== undefined
                    ) {
                        res.setHeader(header, value as string | string[]);
                    }
                }
                res.status(response.status).send(response.data);
            },
            { timeout: 30000 },
        );
        breaker.on('open', () => this.logger.error('circuit_open', { service: route.service }));
        breaker.on('halfOpen', () =>
            this.logger.info('circuit_half_open', { service: route.service }),
        );
        breaker.on('close', () => this.logger.info('circuit_closed', { service: route.service }));
        this.breakers.set(route.service, breaker);
        return breaker;
    }

    private forwardHeaders(req: Request): Record<string, string> {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(req.headers)) {
            if (
                ['host', 'connection', 'content-length'].includes(key.toLowerCase()) ||
                value === undefined
            )
                continue;
            headers[key] = Array.isArray(value) ? value.join(',') : value;
        }
        return headers;
    }

    private async readBody(req: Request): Promise<unknown> {
        if (['GET', 'HEAD'].includes(req.method)) return undefined;
        const parsedBody = (req as Request & { body?: unknown }).body;
        if (parsedBody !== undefined && parsedBody !== null) {
            return parsedBody;
        }
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            req.on('data', (chunk: Buffer) => chunks.push(chunk));
            req.on('error', reject);
            req.on('end', () => {
                const raw = Buffer.concat(chunks).toString('utf8');
                if (!raw) return resolve(undefined);
                if (req.headers['content-type']?.includes('application/json')) {
                    try {
                        return resolve(JSON.parse(raw));
                    } catch (error) {
                        return reject(error);
                    }
                }
                resolve(raw);
            });
        });
    }
}
