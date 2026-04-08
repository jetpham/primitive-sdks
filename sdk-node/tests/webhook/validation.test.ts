import { afterEach, describe, expect, it, vi } from "vitest";
import {
  safeValidateEmailReceivedEvent,
  validateEmailReceivedEvent,
} from "../../src/validation.js";
import { WebhookValidationError } from "../../src/webhook/errors.js";

const validPayload = {
  id: "evt_abc123",
  event: "email.received",
  version: "2025-12-14",
  delivery: {
    endpoint_id: "ep_xyz789",
    attempt: 1,
    attempted_at: "2025-12-14T12:00:00Z",
  },
  email: {
    id: "em_def456",
    received_at: "2025-12-14T11:59:50Z",
    smtp: {
      helo: "mail.example.com",
      mail_from: "sender@example.com",
      rcpt_to: ["recipient@domain.com"],
    },
    headers: {
      message_id: "<abc123@example.com>",
      subject: "Test Email",
      from: "sender@example.com",
      to: "recipient@domain.com",
      date: "Sat, 14 Dec 2025 11:59:50 +0000",
    },
    content: {
      raw: {
        included: true,
        encoding: "base64",
        max_inline_bytes: 262144,
        size_bytes: 1234,
        sha256: "a".repeat(64),
        data: "SGVsbG8gV29ybGQ=",
      },
      download: {
        url: "https://api.primitive.dev/v1/downloads/raw/token123",
        expires_at: "2025-12-15T12:00:00Z",
      },
    },
    parsed: {
      status: "complete",
      error: null,
      body_text: "Hello World",
      body_html: "<p>Hello World</p>",
      reply_to: null,
      cc: null,
      bcc: null,
      in_reply_to: null,
      references: null,
      attachments: [],
      attachments_download_url: null,
    },
    analysis: {},
    auth: {
      spf: "pass",
      dmarc: "pass",
      dmarcPolicy: "reject",
      dmarcFromDomain: "example.com",
      dmarcSpfAligned: true,
      dmarcDkimAligned: true,
      dmarcSpfStrict: false,
      dmarcDkimStrict: false,
      dkimSignatures: [
        {
          domain: "example.com",
          selector: "default",
          result: "pass",
          aligned: true,
          keyBits: 2048,
          algo: "rsa-sha256",
        },
      ],
    },
  },
};

describe("validation", () => {
  afterEach(() => {
    vi.resetModules();
    vi.doUnmock("../../src/generated/email-received-event.validator.generated.js");
  });

  it("returns typed event for valid payload", () => {
    const event = validateEmailReceivedEvent(validPayload);
    expect(event.id).toBe("evt_abc123");
  });

  it("throws WebhookValidationError for invalid payload", () => {
    expect(() => validateEmailReceivedEvent({})).toThrow(WebhookValidationError);
  });

  it("accepts any valid date-formatted version", () => {
    expect(
      validateEmailReceivedEvent({ ...validPayload, version: "2030-12-31" }).version,
    ).toBe("2030-12-31");
  });

  it("returns safe failure shape for invalid payload", () => {
    const result = safeValidateEmailReceivedEvent({ event: "email.received" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe("SCHEMA_VALIDATION_FAILED");
      expect(result.error.validationErrors.length).toBeGreaterThan(0);
    }
  });

  it("formats const validation failures with field-specific guidance", () => {
    try {
      validateEmailReceivedEvent({ ...validPayload, event: "email.opened" });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WebhookValidationError);
      const validationError = error as WebhookValidationError;
      expect(validationError.field).toBe("event");
      expect(validationError.message).toContain("Invalid value for event");
    }
  });

  it("falls back to a payload-level error when the validator reports no issues", async () => {
    const mockedValidator = Object.assign(() => false, { errors: undefined });
    vi.doMock("../../src/generated/email-received-event.validator.generated.js", () => ({
      default: mockedValidator,
    }));

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    try {
      validateWithMock(validPayload);
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toMatchObject({
        code: "SCHEMA_VALIDATION_FAILED",
        field: "payload",
        validationErrors: [],
        message: "Webhook payload failed schema validation",
      });
      expect((error as WebhookValidationError).message).toBe(
        "Webhook payload failed schema validation",
      );
    }
  });

  it("handles null validator errors in the safe validation path", async () => {
    const mockedValidator = Object.assign(() => false, { errors: null });
    vi.doMock("../../src/generated/email-received-event.validator.generated.js", () => ({
      default: mockedValidator,
    }));

    const { safeValidateEmailReceivedEvent: safeValidateWithMock } = await import(
      "../../src/validation.js"
    );

    const result = safeValidateWithMock(validPayload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.validationErrors).toEqual([]);
      expect(result.error.field).toBe("payload");
    }
  });

  it("formats generic validation failures with field-specific guidance", () => {
    try {
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: {
            ...validPayload.email.auth,
            dkimSignatures: [{ ...validPayload.email.auth.dkimSignatures[0], algo: 123 }],
          },
        },
      });
      throw new Error("expected validation to fail");
    } catch (error) {
      expect(error).toBeInstanceOf(WebhookValidationError);
      const validationError = error as WebhookValidationError;
      expect(validationError.field).toContain("email.auth.dkimSignatures");
      expect(validationError.message).toContain("Invalid type for");
    }
  });

  it("formats required validation failures without a reported property name", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/email",
          keyword: "required",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock("../../src/generated/email-received-event.validator.generated.js", () => ({
      default: mockedValidator,
    }));

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    expect(() => validateWithMock(validPayload)).toThrowError(/Missing required field: unknown/);
  });

  it("uses fallback messages when validator errors omit details", async () => {
    const mockedValidator = Object.assign(() => false, {
      errors: [
        {
          instancePath: "/event",
          keyword: "const",
          params: {},
          schemaPath: "",
        },
        {
          instancePath: "/event",
          keyword: "type",
          params: {},
          schemaPath: "",
        },
        {
          instancePath: "/event",
          keyword: "pattern",
          params: {},
          schemaPath: "",
        },
      ],
    });
    vi.doMock("../../src/generated/email-received-event.validator.generated.js", () => ({
      default: mockedValidator,
    }));

    const { validateEmailReceivedEvent: validateWithMock } = await import(
      "../../src/validation.js"
    );

    for (const expected of [
      /must match the expected constant/,
      /wrong type/,
      /Validation failed for event: pattern/,
    ]) {
      try {
        validateWithMock(validPayload);
      } catch (error) {
        expect((error as WebhookValidationError).message).toMatch(expected);
      }
      mockedValidator.errors?.shift();
    }
  });

  it("accepts extra unknown top-level fields like the old validator", () => {
    expect(
      validateEmailReceivedEvent({ ...validPayload, extra_field: "ok" }).id,
    ).toBe("evt_abc123");
  });

  it("accepts extra unknown nested fields like the old validator", () => {
    expect(
      validateEmailReceivedEvent({
        ...validPayload,
        delivery: { ...validPayload.delivery, extra_delivery: true },
        email: {
          ...validPayload.email,
          auth: { ...validPayload.email.auth, extra_auth: "ok" },
        },
      }).id,
    ).toBe("evt_abc123");
  });

  it("rejects javascript URLs in download.url", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          content: {
            ...validPayload.email.content,
            download: {
              ...validPayload.email.content.download,
              url: "javascript:alert(1)",
            },
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("rejects http URLs in attachments_download_url", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            attachments_download_url: "http://example.com/attachments",
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("accepts https URLs in attachments_download_url", () => {
    expect(
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          parsed: {
            ...validPayload.email.parsed,
            attachments_download_url:
              "https://api.primitive.dev/v1/downloads/attachments/token456",
          },
        },
      }).id,
    ).toBe("evt_abc123");
  });

  it("rejects fractional DKIM keyBits", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: {
            ...validPayload.email.auth,
            dkimSignatures: [
              { ...validPayload.email.auth.dkimSignatures[0], keyBits: 1024.5 },
            ],
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("rejects oversized DKIM keyBits", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          auth: {
            ...validPayload.email.auth,
            dkimSignatures: [
              { ...validPayload.email.auth.dkimSignatures[0], keyBits: 20000 },
            ],
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("rejects negative forward attachment counters", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          analysis: {
            forward: {
              detected: false,
              results: [],
              attachments_found: -1,
              attachments_analyzed: 0,
              attachments_limit: null,
            },
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("rejects zero forward attachments_limit", () => {
    expect(() =>
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          analysis: {
            forward: {
              detected: false,
              results: [],
              attachments_found: 0,
              attachments_analyzed: 0,
              attachments_limit: 0,
            },
          },
        },
      }),
    ).toThrow(WebhookValidationError);
  });

  it("accepts valid integer forward attachment counters", () => {
    expect(
      validateEmailReceivedEvent({
        ...validPayload,
        email: {
          ...validPayload.email,
          analysis: {
            forward: {
              detected: true,
              results: [],
              attachments_found: 2,
              attachments_analyzed: 1,
              attachments_limit: 10,
            },
          },
        },
      }).id,
    ).toBe("evt_abc123");
  });
});
