import { createHash } from "node:crypto";
import type {
  EmailAddress,
  EmailAnalysis,
  EmailAuth,
  EmailReceivedEvent,
  ParsedDataComplete,
  ParsedDataFailed,
  ParsedError,
  RawContentDownloadOnly,
  RawContentInline,
  SignResult,
  WebhookAttachment,
} from "@primitivedotdev/sdk-node";
import {
  signWebhookPayload,
  validateEmailReceivedEvent,
  WEBHOOK_VERSION,
} from "@primitivedotdev/sdk-node";

export type {
  EmailAddress,
  EmailAnalysis,
  EmailAuth,
  EmailReceivedEvent,
  ParsedDataComplete,
  ParsedDataFailed,
  ParsedError,
  RawContentDownloadOnly,
  RawContentInline,
  SignResult,
  WebhookAttachment,
};

export { signWebhookPayload, WEBHOOK_VERSION };

export const RAW_EMAIL_INLINE_THRESHOLD = 262144;

export interface ParsedInputComplete {
  status: "complete";
  body_text: string | null;
  body_html: string | null;
  reply_to?: EmailAddress[] | null;
  cc?: EmailAddress[] | null;
  bcc?: EmailAddress[] | null;
  in_reply_to?: string[] | null;
  references?: string[] | null;
  attachments: WebhookAttachment[];
  attachments_storage_key: string | null;
}

export interface ParsedInputFailed {
  status: "failed";
  error: ParsedError;
}

export type ParsedInput = ParsedInputComplete | ParsedInputFailed;

export interface EmailReceivedEventInput {
  email_id: string;
  endpoint_id: string;
  message_id: string | null;
  sender: string;
  recipient: string;
  subject: string | null;
  received_at: string;
  smtp_helo: string | null;
  smtp_mail_from: string;
  smtp_rcpt_to: [string, ...string[]];
  raw_bytes: Buffer;
  raw_sha256: string;
  raw_size_bytes: number;
  attempt_count: number;
  date_header: string | null;
  download_url: string;
  download_expires_at: string;
  attachments_download_url: string | null;
  parsed?: ParsedInput;
  auth: EmailAuth;
  analysis: EmailAnalysis;
}

const ISO_8601_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/;

function validateTimestamp(timestamp: string, fieldName: string): string {
  if (!ISO_8601_PATTERN.test(timestamp)) {
    throw new Error(
      `[@primitivedotdev/contract-node] Invalid ${fieldName}: "${timestamp}". Expected ISO 8601 UTC format (e.g., "2025-01-15T10:30:00.000Z")`,
    );
  }

  const date = new Date(timestamp);
  if (Number.isNaN(date.getTime())) {
    throw new Error(
      `[@primitivedotdev/contract-node] Invalid ${fieldName}: "${timestamp}" is not a valid date`,
    );
  }

  return timestamp;
}

export function generateEventId(endpoint_id: string, email_id: string): string {
  const hashInput = `email.received:${WEBHOOK_VERSION}:${endpoint_id}:${email_id}`;
  const hash = createHash("sha256").update(hashInput).digest("hex");
  return `evt_${hash}`;
}

export function buildEmailReceivedEvent(
  input: EmailReceivedEventInput,
  options?: {
    event_id?: string;
    attempted_at?: string;
  },
): EmailReceivedEvent {
  const event_id =
    options?.event_id ?? generateEventId(input.endpoint_id, input.email_id);
  const attempted_at = options?.attempted_at
    ? validateTimestamp(options.attempted_at, "attempted_at")
    : new Date().toISOString();

  const shouldInline = input.raw_size_bytes <= RAW_EMAIL_INLINE_THRESHOLD;

  const rawContent: RawContentInline | RawContentDownloadOnly = shouldInline
    ? {
        included: true,
        encoding: "base64",
        max_inline_bytes: RAW_EMAIL_INLINE_THRESHOLD,
        size_bytes: input.raw_size_bytes,
        sha256: input.raw_sha256,
        data: input.raw_bytes.toString("base64"),
      }
    : {
        included: false,
        reason_code: "size_exceeded",
        max_inline_bytes: RAW_EMAIL_INLINE_THRESHOLD,
        size_bytes: input.raw_size_bytes,
        sha256: input.raw_sha256,
      };

  let parsedData: ParsedDataComplete | ParsedDataFailed;

  if (input.parsed?.status === "complete") {
    parsedData = {
      status: "complete",
      error: null,
      body_text: shouldInline ? input.parsed.body_text : null,
      body_html: shouldInline ? input.parsed.body_html : null,
      reply_to: input.parsed.reply_to ?? null,
      cc: input.parsed.cc ?? null,
      bcc: input.parsed.bcc ?? null,
      in_reply_to: input.parsed.in_reply_to ?? null,
      references: input.parsed.references ?? null,
      attachments: input.parsed.attachments,
      attachments_download_url: input.attachments_download_url,
    };
  } else if (input.parsed?.status === "failed") {
    parsedData = {
      status: "failed",
      error: input.parsed.error,
      body_text: null,
      body_html: null,
      reply_to: null,
      cc: null,
      bcc: null,
      in_reply_to: null,
      references: null,
      attachments: [],
      attachments_download_url: null,
    };
  } else {
    parsedData = {
      status: "failed",
      error: {
        code: "PARSE_FAILED",
        message: "Parsing not attempted",
        retryable: false,
      },
      body_text: null,
      body_html: null,
      reply_to: null,
      cc: null,
      bcc: null,
      in_reply_to: null,
      references: null,
      attachments: [],
      attachments_download_url: null,
    };
  }

  const event = {
    id: event_id,
    event: "email.received",
    version: WEBHOOK_VERSION,
    delivery: {
      endpoint_id: input.endpoint_id,
      attempt: input.attempt_count,
      attempted_at,
    },
    email: {
      id: input.email_id,
      received_at: validateTimestamp(input.received_at, "received_at"),
      smtp: {
        helo: input.smtp_helo,
        mail_from: input.smtp_mail_from,
        rcpt_to: input.smtp_rcpt_to,
      },
      headers: {
        message_id: input.message_id,
        subject: input.subject,
        from: input.sender,
        to: input.recipient,
        date: input.date_header,
      },
      content: {
        raw: rawContent,
        download: {
          url: input.download_url,
          expires_at: validateTimestamp(
            input.download_expires_at,
            "download_expires_at",
          ),
        },
      },
      parsed: parsedData,
      analysis: input.analysis,
      auth: input.auth,
    },
  } satisfies EmailReceivedEvent;

  return validateEmailReceivedEvent(event);
}
