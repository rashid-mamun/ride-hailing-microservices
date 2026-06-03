import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { NodeSDK } from '@opentelemetry/sdk-node';

let sdk: NodeSDK | undefined;

export function initTracing(serviceName: string): void {
    if (sdk || process.env.NODE_ENV === 'test') return;
    const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    sdk = new NodeSDK({
        serviceName,
        traceExporter: endpoint
            ? new OTLPTraceExporter({ url: `${endpoint.replace(/\/$/, '')}/v1/traces` })
            : undefined,
        instrumentations: [getNodeAutoInstrumentations()],
    });
    sdk.start();
}
