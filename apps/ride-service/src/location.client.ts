import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { createCircuitBreaker } from '@ride-hailing/shared-utils';

export type NearbyDriver = {
    driverId: string;
    lat: number;
    lng: number;
    distanceKm: number;
    heading?: number;
    speed?: number;
};

@Injectable()
export class LocationClient {
    private readonly breaker = createCircuitBreaker(
        async (params: { lat: number; lng: number; radiusKm: number; limit: number }) => {
            const { data } = await axios.get(
                `${process.env.LOCATION_SERVICE_URL}/api/locations/drivers/nearby`,
                { params, timeout: 1500 },
            );
            return data.data as NearbyDriver[];
        },
    );

    async findNearbyDrivers(lat: number, lng: number): Promise<NearbyDriver[]> {
        try {
            return (await this.breaker.fire({ lat, lng, radiusKm: 5, limit: 5 })) as NearbyDriver[];
        } catch {
            return [];
        }
    }
}
