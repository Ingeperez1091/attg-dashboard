import { describe, expect, it } from "vitest";
import { assertAllowedOutboundUrl } from "@/infrastructure/clients/ADFPipelineClient";

describe("assertAllowedOutboundUrl (SSRF guard)", () => {
  it("accepts valid Azure Data Factory HTTPS endpoints", () => {
    const validUrls = [
      "https://my-adf.azure.com/pipelines/trigger",
      "https://management.azure.com/subscriptions/xxx/resourceGroups/rg/providers/Microsoft.DataFactory/factories/f/pipelines/p/createRun",
      "https://my-factory.azure.net/api/trigger",
      "https://storage.windows.net/path",
      "https://my-apim.azure-api.net/adf/trigger",
    ];

    for (const url of validUrls) {
      expect(() => assertAllowedOutboundUrl(url)).not.toThrow();
    }
  });

  it("rejects non-HTTPS protocols", () => {
    expect(() =>
      assertAllowedOutboundUrl("http://management.azure.com/trigger")
    ).toThrow("[SSRF] ADF endpoint must use HTTPS");
  });

  it("rejects non-Azure hostnames", () => {
    const attackUrls = [
      "https://evil.com/management.azure.com",
      "https://169.254.169.254/latest/meta-data",
      "https://internal-server.local/secret",
      "https://localhost:8080/admin",
      "https://azure.com.evil.net/attack",
    ];

    for (const url of attackUrls) {
      expect(() => assertAllowedOutboundUrl(url)).toThrow(
        "[SSRF] ADF endpoint hostname not in allowlist"
      );
    }
  });

  it("rejects invalid URLs", () => {
    expect(() => assertAllowedOutboundUrl("not-a-url")).toThrow(
      "[SSRF] ADF endpoint is not a valid URL"
    );
    expect(() => assertAllowedOutboundUrl("")).toThrow(
      "[SSRF] ADF endpoint is not a valid URL"
    );
  });

  it("rejects FTP and file protocols even with Azure hosts", () => {
    expect(() =>
      assertAllowedOutboundUrl("ftp://management.azure.com/file")
    ).toThrow("[SSRF] ADF endpoint must use HTTPS");
    expect(() =>
      assertAllowedOutboundUrl("file:///etc/passwd")
    ).toThrow("[SSRF] ADF endpoint must use HTTPS");
  });
});
