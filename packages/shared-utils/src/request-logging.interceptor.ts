import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { Observable, tap } from 'rxjs';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
    constructor(private readonly logger: { info: (message: string, meta?: object) => void }) {}

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const now = Date.now();
        const req = context.switchToHttp().getRequest<{ method: string; url: string }>();
        const res = context.switchToHttp().getResponse<{ statusCode: number }>();
        return next.handle().pipe(
            tap(() => {
                this.logger.info('http_request', {
                    method: req.method,
                    path: req.url,
                    statusCode: res.statusCode,
                    durationMs: Date.now() - now,
                    traceId: trace.getActiveSpan()?.spanContext().traceId,
                });
            }),
        );
    }
}
