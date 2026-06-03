import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { PricingRule } from './pricing-rule.entity';
import { CreatePricingSchema1710000000000 } from './migrations/1710000000000-CreatePricingSchema';

export default new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_PRICING_URL,
    entities: [PricingRule],
    migrations: [CreatePricingSchema1710000000000],
    synchronize: false,
});
