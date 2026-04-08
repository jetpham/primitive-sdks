import type { ErrorObject } from "ajv";
import validateEmailReceivedEventSchema from "./generated/email-received-event.validator.generated.js";
import type { EmailReceivedEvent } from "./types.js";
import { WebhookValidationError } from "./webhook/errors.js";

type GeneratedValidator = {
  (input: unknown): boolean;
  errors?: ErrorObject[] | null;
};

const validateSchema = validateEmailReceivedEventSchema as GeneratedValidator;

export interface ValidationSuccess<T> {
  success: true;
  data: T;
}

export interface ValidationFailure {
  success: false;
  error: WebhookValidationError;
}

export type ValidationResult<T> = ValidationSuccess<T> | ValidationFailure;

function toFieldPath(instancePath: string): string {
  if (!instancePath) return "payload";
  return instancePath
    .replace(/^\//, "")
    .split("/")
    .map((segment) => segment.replace(/~1/g, "/").replace(/~0/g, "~"))
    .join(".");
}

function formatValidationIssue(error: ErrorObject): {
  field: string;
  message: string;
  suggestion: string;
} {
  const field = toFieldPath(error.instancePath);

  switch (error.keyword) {
    case "required": {
      const missing = String(error.params.missingProperty ?? "unknown");
      const prefix = field === "payload" ? "payload" : field;
      return {
        field: prefix === "payload" ? missing : `${prefix}.${missing}`,
        message: `Missing required field: ${missing}`,
        suggestion: `Add the required field "${missing}" to the webhook payload.`,
      };
    }
    case "const":
      return {
        field,
        message: `Invalid value for ${field}: ${error.message ?? "must match the expected constant"}`,
        suggestion: `Check the value of "${field}" in the webhook payload.`,
      };
    case "type":
      return {
        field,
        message: `Invalid type for ${field}: ${error.message ?? "wrong type"}`,
        suggestion: `Check the value of "${field}" in the webhook payload.`,
      };
    default:
      return {
        field,
        message: `Validation failed for ${field}: ${error.message ?? error.keyword}`,
        suggestion: `Check the value of "${field}" in the webhook payload.`,
      };
  }
}

function createValidationError(
  errors: readonly ErrorObject[],
): WebhookValidationError {
  if (errors.length === 0) {
    return new WebhookValidationError(
      "payload",
      "Webhook payload failed schema validation",
      'Check the structure of the webhook payload against "emailReceivedEventJsonSchema".',
      [],
    );
  }

  const firstError = errors[0];
  const { field, message, suggestion } = formatValidationIssue(firstError);
  return new WebhookValidationError(field, message, suggestion, [...errors]);
}

export function validateEmailReceivedEvent(input: unknown): EmailReceivedEvent {
  if (!validateSchema(input)) {
    throw createValidationError(validateSchema.errors ?? []);
  }

  return input as EmailReceivedEvent;
}

export function safeValidateEmailReceivedEvent(
  input: unknown,
): ValidationResult<EmailReceivedEvent> {
  if (!validateSchema(input)) {
    return {
      success: false,
      error: createValidationError(validateSchema.errors ?? []),
    };
  }

  return {
    success: true,
    data: input as EmailReceivedEvent,
  };
}
