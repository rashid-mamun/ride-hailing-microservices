import Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

    RABBITMQ_URL: Joi.string().uri().required(),
    SMTP_HOST: Joi.string().optional(),
    SMTP_PORT: Joi.number().port().optional(),
    SMTP_USER: Joi.string().optional(),
    SMTP_PASS: Joi.string().optional(),
    NOTIFICATION_SERVICE_PORT: Joi.number().port().default(3005),

    OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
    OTEL_SERVICE_NAME: Joi.string().optional(),
});
