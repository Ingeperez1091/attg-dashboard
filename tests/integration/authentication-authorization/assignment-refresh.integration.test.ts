import { beforeEach, describe, expect, it } from "vitest";
import { getRuntimeRepositories } from "@/infrastructure/persistence/runtime/repositories";
import { GET as getApplicationModel } from "@/app/api/applications/[appId]/numeratormodel/route";
import { POST as previewDenominatorRules } from "@/app/api/filters/denominator/[appId]/preview/route";
import { createSessionUser, resetAuthIntegrationState } from "./auth-test-helpers";

describe("integration - role and assignment changes apply on next authorization check", () => {
  const appIdOne = "10000000-0000-0000-0000-000000000001";
  const appIdTwo = "10000000-0000-0000-0000-000000000002";

  beforeEach(() => {
    resetAuthIntegrationState();
  });

  it("applies updated application assignments on subsequent requests", async () => {
    const repositories = getRuntimeRepositories();
    const userId = await createSessionUser({
      role: "application_owner",
      applicationIds: [appIdOne]
    });

    const beforeResponse = await getApplicationModel(
      new Request(`http://localhost/api/applications/${appIdTwo}/numeratormodel`, {
        method: "GET",
        headers: { Cookie: `dev_user_id=${userId}` }
      }),
      { params: Promise.resolve({ appId: appIdTwo }) }
    );

    expect(beforeResponse.status).toBe(403);

    await repositories.userApplications.assign(userId, appIdTwo, "seed");

    const afterResponse = await getApplicationModel(
      new Request(`http://localhost/api/applications/${appIdTwo}/numeratormodel`, {
        method: "GET",
        headers: { Cookie: `dev_user_id=${userId}` }
      }),
      { params: Promise.resolve({ appId: appIdTwo }) }
    );

    expect(afterResponse.status).toBe(200);
  });

  it("applies updated roles on subsequent write authorization checks", async () => {
    const repositories = getRuntimeRepositories();
    const userId = await createSessionUser({
      role: "viewer",
      applicationIds: [appIdOne]
    });

    const validPreviewBody = {
      rules: [
        {
          denominatorModelId: "50000000-0000-0000-0007-000000000000",
          operator: "EQUALS",
          value: "11420"
        }
      ]
    };

    const beforeResponse = await previewDenominatorRules(
      new Request(`http://localhost/api/filters/denominator/${appIdOne}/preview`, {
        method: "POST",
        headers: {
          Cookie: `dev_user_id=${userId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(validPreviewBody)
      }),
      { params: Promise.resolve({ appId: appIdOne }) }
    );

    expect(beforeResponse.status).toBe(403);

    await repositories.roles.assignRole(userId, "application_owner", "seed");

    const afterResponse = await previewDenominatorRules(
      new Request(`http://localhost/api/filters/denominator/${appIdOne}/preview`, {
        method: "POST",
        headers: {
          Cookie: `dev_user_id=${userId}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(validPreviewBody)
      }),
      { params: Promise.resolve({ appId: appIdOne }) }
    );

    // SSE stream returns 200 with text/event-stream for authorized users
    expect(afterResponse.status).toBe(200);
    expect(afterResponse.headers.get("Content-Type")).toBe("text/event-stream");
  });
});
