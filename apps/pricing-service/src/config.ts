import Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

    POSTGRES_PRICING_URL: Joi.string().uri().required(),
    REDIS_URL: Joi.string().uri().required(),
    RABBITMQ_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    PRICING_SERVICE_PORT: Joi.number().port().default(3004),
    SURGE_THRESHOLD_1: Joi.number().default(50),
    SURGE_THRESHOLD_2: Joi.number().default(100),

    OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
    OTEL_SERVICE_NAME: Joi.string().optional(),
});
