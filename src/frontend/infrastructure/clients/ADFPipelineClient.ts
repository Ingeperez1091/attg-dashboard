import {
  TriggerPipelineInput,
  TriggerPipelineResult
} from "@/core/application/dto/pipeline/PipelineTriggerDto";
import { IADFPipelineClient } from "@/core/application/clients/IADFPipelineClient";

/**
 * Allowed Azure hostname suffixes for outbound SSRF protection.
 * Only HTTPS endpoints on these domains are permitted.
 */
const ALLOWED_HOST_SUFFIXES = [
  ".azure.com",
  ".azure.net",
  ".windows.net",
  ".azure-api.net",
];

/**
 * Validates that a URL is HTTPS and resolves to a known Azure host.
 * Prevents SSRF by rejecting arbitrary or internal endpoints.
 */
export function assertAllowedOutboundUrl(endpoint: string): void {
  let parsed: URL;
  try {
    parsed = new URL(endpoint);
  } catch {
    throw new Error(
      `[SSRF] ADF endpoint is not a valid URL: ${endpoint.slice(0, 80)}`
    );
  }

  if (parsed.protocol !== "https:") {
    throw new Error(
      `[SSRF] ADF endpoint must use HTTPS, got: ${parsed.protocol}`
    );
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOST_SUFFIXES.some((suffix) =>
    hostname.endsWith(suffix)
  );
  if (!allowed) {
    throw new Error(
      `[SSRF] ADF endpoint hostname not in allowlist: ${hostname}`
    );
  }
}

export class ADFPipelineClient implements IADFPipelineClient {
  readonly executionMode: "adf" | "local";

  constructor(
    private readonly adfEndpoint = process.env.ADF_PIPELINE_TRIGGER_ENDPOINT,
    private readonly adfAuthToken = process.env.ADF_PIPELINE_TRIGGER_TOKEN
  ) {
    if (adfEndpoint) {
      assertAllowedOutboundUrl(adfEndpoint);
    }
    this.executionMode = adfEndpoint ? "adf" : "local";
  }

  async triggerValidationPipeline(input: TriggerPipelineInput): Promise<TriggerPipelineResult> {
    if (!this.adfEndpoint) {
      return {
        accepted: true,
        executionMode: "local"
      };
    }

    const response = await fetch(this.adfEndpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(this.adfAuthToken ? { Authorization: `Bearer ${this.adfAuthToken}` } : {})
      },
      body: JSON.stringify({
        applicationId: input.applicationId,
        runId: input.runId,
        triggerSource: input.triggerSource,
        actorUserId: input.actorUserId,
        ...(input.previewSessionId ? { previewSessionId: input.previewSessionId } : {})
      })
    });

    if (!response.ok) {
      throw new Error(`ADF trigger failed with status ${response.status}`);
    }

    const body = (await response.json().catch(() => ({}))) as { runId?: string };
    return {
      accepted: true,
      executionMode: "adf",
      externalRunId: body.runId
    };
  }
}
