import Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

    REDIS_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    LOCATION_SERVICE_PORT: Joi.number().port().default(3003),

    OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
    OTEL_SERVICE_NAME: Joi.string().optional(),
});
