export type UserRole = 'rider' | 'driver' | 'admin';
export type RideStatus =
    | 'requested'
    | 'driver_matched'
    | 'driver_arrived'
    | 'in_progress'
    | 'completed'
    | 'cancelled';

export interface JwtPayload {
    sub: string;
    email: string;
    role: UserRole;
}

export interface PaginationDto {
    page: number;
    limit: number;
}

export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    message?: string;
    error?: string;
    meta?: { page: number; limit: number; total: number; totalPages: number };
}

export interface ServiceHealthResponse {
    status: 'ok' | 'degraded';
    service: string;
    timestamp: string;
}
