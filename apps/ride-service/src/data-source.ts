import 'reflect-metadata';
import { DataSource } from 'typeorm';
import { OutboxEvent } from './entities/outbox-event.entity';
import { Ride } from './entities/ride.entity';
import { CreateRideSchema1710000000000 } from './migrations/1710000000000-CreateRideSchema';

export default new DataSource({
    type: 'postgres',
    url: process.env.POSTGRES_RIDE_URL,
    entities: [Ride, OutboxEvent],
    migrations: [CreateRideSchema1710000000000],
    synchronize: false,
});
