import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  RawEmailDecodeError,
  WebhookValidationError,
  WebhookVerificationError,
  decodeRawEmail,
  isRawIncluded,
  safeValidateEmailReceivedEvent,
  validateEmailAuth,
  validateEmailReceivedEvent,
  verifyRawEmailDownload,
  verifyWebhookSignature,
} from "../../src/index.js";
import { signWebhookPayload } from "../../src/webhook/signing.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = join(__dirname, "../../../test-fixtures");

function loadJson<T>(...parts: string[]): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, ...parts), "utf8")) as T;
}

describe("shared compatibility fixtures", () => {
  it("validates shared webhook cases", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        payload: unknown;
        expected: { valid: boolean; id?: string; error_code?: string };
      }>;
    }>("webhook", "validation-cases.json");

    for (const testCase of fixtures.cases) {
      if (testCase.expected.valid) {
        const event = validateEmailReceivedEvent(testCase.payload);
        expect(event.id, testCase.name).toBe(testCase.expected.id);
        const safeResult = safeValidateEmailReceivedEvent(testCase.payload);
        expect(safeResult.success, testCase.name).toBe(true);
      } else {
        expect(() => validateEmailReceivedEvent(testCase.payload), testCase.name).toThrow(
          WebhookValidationError,
        );
        const safeResult = safeValidateEmailReceivedEvent(testCase.payload);
        expect(safeResult.success, testCase.name).toBe(false);
        if (!safeResult.success) {
          expect(safeResult.error.code, testCase.name).toBe(
            testCase.expected.error_code,
          );
        }
      }
    }
  });

  it("verifies shared signing fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        raw_body: string;
        secret: string;
        timestamp: number;
        verify_secret?: string;
        now_seconds?: number;
        expected_v1: string;
        expected_valid: boolean;
        expected_error_code?: string;
      }>;
    }>("signing", "vectors.json");

    for (const testCase of fixtures.cases) {
      const signed = signWebhookPayload(
        testCase.raw_body,
        testCase.secret,
        testCase.timestamp,
      );
      expect(signed.v1, testCase.name).toBe(testCase.expected_v1);

      const verifySecret = testCase.verify_secret ?? testCase.secret;
      const nowSeconds = testCase.now_seconds ?? testCase.timestamp;

      if (testCase.expected_valid) {
        expect(
          verifyWebhookSignature({
            rawBody: testCase.raw_body,
            signatureHeader: signed.header,
            secret: verifySecret,
            nowSeconds,
          }),
          testCase.name,
        ).toBe(true);
      } else {
        try {
          verifyWebhookSignature({
            rawBody: testCase.raw_body,
            signatureHeader: signed.header,
            secret: verifySecret,
            nowSeconds,
          });
          expect.fail(`Expected verification failure for ${testCase.name}`);
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(WebhookVerificationError);
          expect((error as WebhookVerificationError).code, testCase.name).toBe(
            testCase.expected_error_code,
          );
        }
      }
    }
  });

  it("classifies shared auth fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        input: Parameters<typeof validateEmailAuth>[0];
        expected: { verdict: string; confidence: string };
      }>;
    }>("auth", "cases.json");

    for (const testCase of fixtures.cases) {
      const result = validateEmailAuth(testCase.input);
      expect(result.verdict, testCase.name).toBe(testCase.expected.verdict);
      expect(result.confidence, testCase.name).toBe(
        testCase.expected.confidence,
      );
    }
  });

  it("handles shared raw content fixtures", () => {
    const fixtures = loadJson<{
      cases: Array<{
        name: string;
        event: any;
        download_bytes_utf8?: string;
        expected: {
          included: boolean;
          decoded_utf8?: string;
          decode_error_code?: string;
          verify_download?: boolean;
        };
      }>;
    }>("raw", "cases.json");

    for (const testCase of fixtures.cases) {
      expect(isRawIncluded(testCase.event), testCase.name).toBe(
        testCase.expected.included,
      );

      if (testCase.expected.decoded_utf8) {
        expect(decodeRawEmail(testCase.event).toString("utf8"), testCase.name).toBe(
          testCase.expected.decoded_utf8,
        );
      }

      if (testCase.expected.decode_error_code) {
        try {
          decodeRawEmail(testCase.event);
          expect.fail(`Expected decode failure for ${testCase.name}`);
        } catch (error) {
          expect(error, testCase.name).toBeInstanceOf(RawEmailDecodeError);
          expect((error as RawEmailDecodeError).code, testCase.name).toBe(
            testCase.expected.decode_error_code,
          );
        }
      }

      if (testCase.expected.verify_download) {
        const downloaded = Buffer.from(testCase.download_bytes_utf8 ?? "", "utf8");
        expect(verifyRawEmailDownload(downloaded, testCase.event), testCase.name).toEqual(
          downloaded,
        );
      }
    }
  });
});
