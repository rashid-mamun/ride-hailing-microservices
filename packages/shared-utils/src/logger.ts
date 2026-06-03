import winston from 'winston';

export function createLogger(serviceName: string): winston.Logger {
    const isProd = process.env.NODE_ENV === 'production';
    return winston.createLogger({
        level: isProd ? 'info' : 'debug',
        defaultMeta: { service: serviceName },
        format: isProd
            ? winston.format.combine(
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.json(),
              )
            : winston.format.combine(
                  winston.format.colorize(),
                  winston.format.timestamp(),
                  winston.format.errors({ stack: true }),
                  winston.format.printf((info) => {
                      const { timestamp, level, message, service, ...meta } = info;
                      return `${timestamp} [${service}] ${level}: ${message} ${Object.keys(meta).length ? JSON.stringify(meta) : ''}`;
                  }),
              ),
        transports: [new winston.transports.Console()],
    });
}
