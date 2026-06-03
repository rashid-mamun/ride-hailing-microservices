import 'reflect-metadata';
import dataSource from './data-source';
import { PricingRule } from './pricing-rule.entity';

async function seed() {
    await dataSource.initialize();
    const rules = dataSource.getRepository(PricingRule);
    if (!(await rules.exists({ where: { isActive: true } }))) {
        await rules.save({ name: 'Default Dhaka Rule' });
    }
    await dataSource.destroy();
}

void seed();
