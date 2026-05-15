export interface NumeratorPayloadRecord {
  [key: string]: unknown;
}

export interface BuildNumeratorRequestOptions {
  applicationId?: string;
  payload?: NumeratorPayloadRecord[] | NumeratorPayloadRecord;
}

const DEFAULT_APPLICATION_ID = "10000000-0000-0000-0000-000000000001";

const DEFAULT_PAYLOAD: NumeratorPayloadRecord[] = [
  {
    engagementId: "E-12345",
    region: "US",
    numeratorValue: 1
  }
];

export function buildNumeratorRequest(
  options: BuildNumeratorRequestOptions = {}
): { applicationId: string; payload: NumeratorPayloadRecord[] | NumeratorPayloadRecord } {
  return {
    applicationId: options.applicationId ?? DEFAULT_APPLICATION_ID,
    payload: options.payload ?? DEFAULT_PAYLOAD
  };
}
