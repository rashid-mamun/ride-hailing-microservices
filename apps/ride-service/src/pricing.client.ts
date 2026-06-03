import { Injectable } from '@nestjs/common';
import axios from 'axios';
import { createCircuitBreaker } from '@ride-hailing/shared-utils';

@Injectable()
export class PricingClient {
    private readonly breaker = createCircuitBreaker(async (params: Record<string, number>) => {
        const { data } = await axios.get(
            `${process.env.PRICING_SERVICE_URL}/api/pricing/estimate`,
            { params, timeout: 2000 },
        );
        return data.data as {
            estimatedFare: number;
            breakdown: { distanceKm: number; estimatedMinutes: number };
        };
    });

    async estimate(params: Record<string, number>) {
        try {
            return (await this.breaker.fire(params)) as {
                estimatedFare: number;
                breakdown: { distanceKm: number; estimatedMinutes: number };
            };
        } catch {
            const distanceKm = this.haversine(
                params.pickupLat,
                params.pickupLng,
                params.dropoffLat,
                params.dropoffLng,
            );
            return {
                estimatedFare: Math.max(50, Math.round((30 + distanceKm * 12) / 5) * 5),
                breakdown: { distanceKm, estimatedMinutes: Math.ceil((distanceKm / 30) * 60) },
            };
        }
    }

    private haversine(aLat: number, aLng: number, bLat: number, bLng: number): number {
        const r = 6371;
        const toRad = (n: number) => (n * Math.PI) / 180;
        const dLat = toRad(bLat - aLat);
        const dLng = toRad(bLng - aLng);
        const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
        return Number((2 * r * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));
    }
}
