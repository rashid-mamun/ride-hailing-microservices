import Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

    POSTGRES_RIDE_URL: Joi.string().uri().required(),
    REDIS_URL: Joi.string().uri().required(),
    RABBITMQ_URL: Joi.string().uri().required(),
    PRICING_SERVICE_URL: Joi.string().uri().required(),
    LOCATION_SERVICE_URL: Joi.string().uri().required(),
    JWT_SECRET: Joi.string().min(32).required(),
    RIDE_SERVICE_PORT: Joi.number().port().default(3002),

    OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
    OTEL_SERVICE_NAME: Joi.string().optional(),
});
