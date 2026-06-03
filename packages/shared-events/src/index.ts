export const EXCHANGES = {
    RIDE: 'ride.exchange',
    AUTH: 'auth.exchange',
    NOTIFICATION: 'notification.exchange',
} as const;

export const ROUTING_KEYS = {
    RIDE_REQUESTED: 'ride.requested',
    RIDE_DRIVER_MATCHED: 'ride.driver.matched',
    RIDE_STARTED: 'ride.started',
    RIDE_COMPLETED: 'ride.completed',
    RIDE_CANCELLED: 'ride.cancelled',
    PAYMENT_PROCESSED: 'payment.processed',
    PAYMENT_FAILED: 'payment.failed',
    NOTIFICATION_EMAIL: 'notification.email',
    NOTIFICATION_PUSH: 'notification.push',
} as const;

export type RoutingKey = (typeof ROUTING_KEYS)[keyof typeof ROUTING_KEYS];

export interface RideRequestedEvent {
    rideId: string;
    riderId: string;
    pickupLat: number;
    pickupLng: number;
    dropoffLat: number;
    dropoffLng: number;
    estimatedFare: number;
}

export interface RideDriverMatchedEvent {
    rideId: string;
    driverId: string;
    driverName: string;
    estimatedArrivalMinutes: number;
}

export interface RideCompletedEvent {
    rideId: string;
    riderId: string;
    driverId: string;
    finalFare: number;
    distanceKm: number;
    durationMinutes: number;
}

export interface RideCancelledEvent {
    rideId: string;
    riderId: string;
    driverId?: string;
    reason: string;
    cancelledBy: 'rider' | 'driver' | 'system';
}

export interface NotificationEmailEvent {
    to: string;
    subject: string;
    templateName: string;
    templateData: Record<string, unknown>;
}

export interface PaymentProcessedEvent {
    rideId: string;
    riderId: string;
    driverId: string;
    finalFare: number;
    transactionId: string;
}

export interface PaymentFailedEvent {
    rideId: string;
    riderId: string;
    driverId?: string;
    reason: string;
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
    typeof value === 'object' && value !== null;
const hasString = (value: Record<string, unknown>, key: string): boolean =>
    typeof value[key] === 'string' && String(value[key]).length > 0;
const hasNumber = (value: Record<string, unknown>, key: string): boolean =>
    typeof value[key] === 'number' && Number.isFinite(value[key]);

export function assertEventPayload(
    routingKey: RoutingKey,
    payload: unknown,
): asserts payload is Record<string, unknown> {
    if (!isRecord(payload)) throw new Error(`Invalid ${routingKey} payload`);

    const validators: Partial<Record<RoutingKey, (value: Record<string, unknown>) => boolean>> = {
        [ROUTING_KEYS.RIDE_REQUESTED]: (value) =>
            hasString(value, 'rideId') &&
            hasString(value, 'riderId') &&
            hasNumber(value, 'pickupLat') &&
            hasNumber(value, 'pickupLng') &&
            hasNumber(value, 'dropoffLat') &&
            hasNumber(value, 'dropoffLng') &&
            hasNumber(value, 'estimatedFare'),
        [ROUTING_KEYS.RIDE_DRIVER_MATCHED]: (value) =>
            hasString(value, 'rideId') &&
            hasString(value, 'driverId') &&
            hasString(value, 'driverName') &&
            hasNumber(value, 'estimatedArrivalMinutes'),
        [ROUTING_KEYS.RIDE_COMPLETED]: (value) =>
            hasString(value, 'rideId') &&
            hasString(value, 'riderId') &&
            hasString(value, 'driverId') &&
            hasNumber(value, 'finalFare'),
        [ROUTING_KEYS.RIDE_CANCELLED]: (value) =>
            hasString(value, 'rideId') &&
            hasString(value, 'riderId') &&
            hasString(value, 'reason') &&
            ['rider', 'driver', 'system'].includes(String(value.cancelledBy)),
        [ROUTING_KEYS.PAYMENT_PROCESSED]: (value) =>
            hasString(value, 'rideId') &&
            hasString(value, 'riderId') &&
            hasString(value, 'driverId') &&
            hasNumber(value, 'finalFare') &&
            hasString(value, 'transactionId'),
        [ROUTING_KEYS.PAYMENT_FAILED]: (value) =>
            hasString(value, 'rideId') && hasString(value, 'riderId') && hasString(value, 'reason'),
    };

    const validator = validators[routingKey];
    if (validator && !validator(payload)) throw new Error(`Invalid ${routingKey} payload`);
}
