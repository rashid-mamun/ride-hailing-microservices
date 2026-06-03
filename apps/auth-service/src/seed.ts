import 'reflect-metadata';
import bcrypt from 'bcrypt';
import dataSource from './data-source';
import { Driver } from './entities/driver.entity';
import { User } from './entities/user.entity';

async function seed() {
    await dataSource.initialize();
    const users = dataSource.getRepository(User);
    const drivers = dataSource.getRepository(Driver);
    const passwordHash = await bcrypt.hash('StrongPass123', 12);

    const admin = await users.findOneBy({ email: 'admin@example.com' });
    if (!admin) {
        await users.save({
            email: 'admin@example.com',
            passwordHash,
            role: 'admin',
            firstName: 'System',
            lastName: 'Admin',
            phoneNumber: '+8801711111111',
            isEmailVerified: true,
        });
    }

    const rider = await users.findOneBy({ email: 'rider@example.com' });
    if (!rider) {
        await users.save({
            email: 'rider@example.com',
            passwordHash,
            role: 'rider',
            firstName: 'Demo',
            lastName: 'Rider',
            phoneNumber: '+8801722222222',
            isEmailVerified: true,
        });
    }

    let driver = await users.findOneBy({ email: 'driver@example.com' });
    if (!driver) {
        driver = await users.save({
            email: 'driver@example.com',
            passwordHash,
            role: 'driver',
            firstName: 'Demo',
            lastName: 'Driver',
            phoneNumber: '+8801733333333',
            isEmailVerified: true,
        });
    }
    if (!(await drivers.findOneBy({ userId: driver.id }))) {
        await drivers.save({
            userId: driver.id,
            vehicleModel: 'Toyota Axio',
            vehiclePlate: 'DHA-DEMO-1',
            isAvailable: true,
        });
    }

    await dataSource.destroy();
}

void seed();
