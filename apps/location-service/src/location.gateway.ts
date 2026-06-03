import { ForbiddenException } from '@nestjs/common';
import {
    OnGatewayConnection,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import type { JwtPayload } from '@ride-hailing/shared-types';
import { LocationService } from './location.service';
import { UpdateLocationDto } from './dto/location.dto';

@WebSocketGateway({ cors: { origin: '*' } })
export class LocationGateway implements OnGatewayConnection {
    @WebSocketServer() server!: Server;
    constructor(private readonly locationService: LocationService) {}
    handleConnection(socket: Socket) {
        const token = socket.handshake.auth.token as string | undefined;
        if (!token) return socket.disconnect(true);
        try {
            socket.data.user = jwt.verify(token, process.env.JWT_SECRET || '') as JwtPayload;
        } catch {
            socket.disconnect(true);
        }
    }
    @SubscribeMessage('driver:location:update')
    async update(socket: Socket, payload: UpdateLocationDto & { driverId: string }) {
        const user = socket.data.user as JwtPayload | undefined;
        if (!user || user.role !== 'driver' || user.sub !== payload.driverId) {
            throw new ForbiddenException('driverId must match authenticated driver');
        }
        await this.locationService.updateDriverLocation(payload.driverId, payload);
        if (payload.rideId)
            this.server
                .to(`ride:${payload.rideId}`)
                .emit('driver:location', { ...payload, timestamp: new Date().toISOString() });
    }
    @SubscribeMessage('rider:watch:ride')
    watch(socket: Socket, payload: { rideId: string }) {
        socket.join(`ride:${payload.rideId}`);
    }
}
