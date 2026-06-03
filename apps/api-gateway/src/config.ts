import Joi from 'joi';

export const validationSchema = Joi.object({
    NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),

    JWT_SECRET: Joi.string().min(32).required(),
    REDIS_URL: Joi.string().uri().required(),
    RABBITMQ_URL: Joi.string().uri().required(),
    AUTH_SERVICE_URL: Joi.string().uri().required(),
    RIDE_SERVICE_URL: Joi.string().uri().required(),
    LOCATION_SERVICE_URL: Joi.string().uri().required(),
    PRICING_SERVICE_URL: Joi.string().uri().required(),
    PAYMENT_SERVICE_URL: Joi.string().uri().required(),
    API_GATEWAY_PORT: Joi.number().port().default(3000),

    OTEL_EXPORTER_OTLP_ENDPOINT: Joi.string().uri().optional(),
    OTEL_SERVICE_NAME: Joi.string().optional(),
});
