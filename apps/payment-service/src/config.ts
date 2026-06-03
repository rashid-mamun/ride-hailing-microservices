import Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
    POSTGRES_PAYMENT_URL: Joi.string().uri().required(),
    RABBITMQ_URL: Joi.string().uri().required(),
    PAYMENT_SERVICE_PORT: Joi.number().port().default(3006),
    PAYMENT_FAILURE_RATE: Joi.number().min(0).max(1).default(0),
    OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
    OTEL_SERVICE_NAME: Joi.string().optional(),
});
