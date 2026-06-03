import type { ApiResponse } from '@ride-hailing/shared-types';

export const response = {
    success<T>(data: T, message?: string): ApiResponse<T> {
        return { success: true, data, message };
    },
    error(error: string, message?: string): ApiResponse<never> {
        return { success: false, error, message };
    },
    paginated<T>(data: T[], page: number, limit: number, total: number): ApiResponse<T[]> {
        return {
            success: true,
            data,
            meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
        };
    },
};
