import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthController } from './health.controller';
import { validationSchema } from './config';
import { NotificationConsumer } from './notification.consumer';
import { EmailService } from './email.service';

@Module({
    imports: [ConfigModule.forRoot({ isGlobal: true, validationSchema })],
    controllers: [HealthController],
    providers: [NotificationConsumer, EmailService],
})
export class AppModule {}
