import CircuitBreaker from 'opossum';

export function createCircuitBreaker<TArgs extends unknown[], TResult>(
    fn: (...args: TArgs) => Promise<TResult>,
    options: CircuitBreaker.Options<TArgs> = {},
): CircuitBreaker<TArgs, TResult> {
    return new CircuitBreaker(fn, {
        timeout: 3000,
        errorThresholdPercentage: 50,
        resetTimeout: 10000,
        rollingCountTimeout: 30000,
        ...options,
    });
}
