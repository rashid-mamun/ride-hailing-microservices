import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import { trace } from '@opentelemetry/api';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
    constructor(private readonly logger: { error: (message: string, meta?: object) => void }) {}

    catch(exception: unknown, host: ArgumentsHost): void {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<{
            status: (code: number) => { json: (body: object) => void };
        }>();
        const traceId = trace.getActiveSpan()?.spanContext().traceId;
        let status = HttpStatus.INTERNAL_SERVER_ERROR;
        let error = 'Internal server error';
        if (exception instanceof HttpException) {
            status = exception.getStatus();
            const body = exception.getResponse();
            error =
                typeof body === 'string'
                    ? body
                    : (
                          body as { message?: string | string[]; error?: string }
                      ).message?.toString() ||
                      (body as { error?: string }).error ||
                      exception.message;
        } else if (exception instanceof Error) {
            if (exception.name === 'EntityNotFoundError') {
                status = HttpStatus.NOT_FOUND;
                error = 'Resource not found';
            } else if (
                exception.name === 'QueryFailedError' &&
                exception.message.includes('duplicate key')
            ) {
                status = HttpStatus.CONFLICT;
                error = 'Resource already exists';
            } else {
                error = exception.message;
            }
        }
        this.logger.error('unhandled_exception', {
            status,
            error,
            traceId,
            stack: exception instanceof Error ? exception.stack : undefined,
        });
        response.status(status).json({ success: false, error, traceId });
    }
}
