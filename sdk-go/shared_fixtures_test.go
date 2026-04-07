package primitive

import (
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"runtime"
	"testing"
)

func loadFixtureCases[T any](t *testing.T, parts ...string) T {
	t.Helper()
	_, filename, _, _ := runtime.Caller(0)
	base := filepath.Join(filepath.Dir(filename), "..", "test-fixtures")
	all := append([]string{base}, parts...)
	data, err := os.ReadFile(filepath.Join(all...))
	if err != nil {
		t.Fatalf("read fixture file: %v", err)
	}
	var value T
	if err := json.Unmarshal(data, &value); err != nil {
		t.Fatalf("decode fixture file: %v", err)
	}
	return value
}

func TestSharedCompatibilityFixtures(t *testing.T) {
	t.Run("webhook validation", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name     string         `json:"name"`
				Payload  map[string]any `json:"payload"`
				Expected struct {
					Valid     bool   `json:"valid"`
					ID        string `json:"id"`
					ErrorCode string `json:"error_code"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "webhook", "validation-cases.json")

		for _, testCase := range fixtures.Cases {
			if testCase.Expected.Valid {
				event, err := ValidateEmailReceivedEvent(testCase.Payload)
				if err != nil {
					t.Fatalf("%s: ValidateEmailReceivedEvent returned error: %v", testCase.Name, err)
				}
				if event.ID != testCase.Expected.ID {
					t.Fatalf("%s: unexpected event ID %q", testCase.Name, event.ID)
				}
				if !SafeValidateEmailReceivedEvent(testCase.Payload).Success {
					t.Fatalf("%s: expected safe validation success", testCase.Name)
				}
				continue
			}

			_, err := ValidateEmailReceivedEvent(testCase.Payload)
			var validationErr *WebhookValidationError
			if !errors.As(err, &validationErr) {
				t.Fatalf("%s: expected WebhookValidationError, got %v", testCase.Name, err)
			}
			if validationErr.Code() != testCase.Expected.ErrorCode {
				t.Fatalf("%s: unexpected error code %q", testCase.Name, validationErr.Code())
			}
		}
	})

	t.Run("signing", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name              string `json:"name"`
				RawBody           string `json:"raw_body"`
				Secret            string `json:"secret"`
				Timestamp         int64  `json:"timestamp"`
				VerifySecret      string `json:"verify_secret"`
				NowSeconds        int64  `json:"now_seconds"`
				ExpectedV1        string `json:"expected_v1"`
				ExpectedValid     bool   `json:"expected_valid"`
				ExpectedErrorCode string `json:"expected_error_code"`
			} `json:"cases"`
		}](t, "signing", "vectors.json")

		for _, testCase := range fixtures.Cases {
			signed, err := SignWebhookPayload(testCase.RawBody, testCase.Secret, testCase.Timestamp)
			if err != nil {
				t.Fatalf("%s: SignWebhookPayload returned error: %v", testCase.Name, err)
			}
			if signed.V1 != testCase.ExpectedV1 {
				t.Fatalf("%s: unexpected signature %q", testCase.Name, signed.V1)
			}

			verifySecret := testCase.VerifySecret
			if verifySecret == "" {
				verifySecret = testCase.Secret
			}
			nowSeconds := testCase.NowSeconds
			if nowSeconds == 0 {
				nowSeconds = testCase.Timestamp
			}

			_, err = VerifyWebhookSignature(VerifyOptions{
				RawBody:         testCase.RawBody,
				SignatureHeader: signed.Header,
				Secret:          verifySecret,
				NowSeconds:      &nowSeconds,
			})

			if testCase.ExpectedValid {
				if err != nil {
					t.Fatalf("%s: VerifyWebhookSignature returned error: %v", testCase.Name, err)
				}
				continue
			}

			var verificationErr *WebhookVerificationError
			if !errors.As(err, &verificationErr) {
				t.Fatalf("%s: expected WebhookVerificationError, got %v", testCase.Name, err)
			}
			if verificationErr.Code() != testCase.ExpectedErrorCode {
				t.Fatalf("%s: unexpected error code %q", testCase.Name, verificationErr.Code())
			}
		}
	})

	t.Run("auth", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name     string `json:"name"`
				Input    any    `json:"input"`
				Expected struct {
					Verdict    AuthVerdict    `json:"verdict"`
					Confidence AuthConfidence `json:"confidence"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "auth", "cases.json")

		for _, testCase := range fixtures.Cases {
			result, err := ValidateEmailAuth(testCase.Input)
			if err != nil {
				t.Fatalf("%s: ValidateEmailAuth returned error: %v", testCase.Name, err)
			}
			if result.Verdict != testCase.Expected.Verdict || result.Confidence != testCase.Expected.Confidence {
				t.Fatalf("%s: unexpected result %#v", testCase.Name, result)
			}
		}
	})

	t.Run("raw", func(t *testing.T) {
		fixtures := loadFixtureCases[struct {
			Cases []struct {
				Name              string         `json:"name"`
				Event             map[string]any `json:"event"`
				DownloadBytesUTF8 string         `json:"download_bytes_utf8"`
				Expected          struct {
					Included        bool   `json:"included"`
					DecodedUTF8     string `json:"decoded_utf8"`
					DecodeErrorCode string `json:"decode_error_code"`
					VerifyDownload  bool   `json:"verify_download"`
				} `json:"expected"`
			} `json:"cases"`
		}](t, "raw", "cases.json")

		for _, testCase := range fixtures.Cases {
			included, err := IsRawIncluded(testCase.Event)
			if err != nil {
				t.Fatalf("%s: IsRawIncluded returned error: %v", testCase.Name, err)
			}
			if included != testCase.Expected.Included {
				t.Fatalf("%s: unexpected included flag %v", testCase.Name, included)
			}

			if testCase.Expected.DecodedUTF8 != "" {
				decoded, err := DecodeRawEmail(testCase.Event)
				if err != nil {
					t.Fatalf("%s: DecodeRawEmail returned error: %v", testCase.Name, err)
				}
				if string(decoded) != testCase.Expected.DecodedUTF8 {
					t.Fatalf("%s: unexpected decoded content %q", testCase.Name, string(decoded))
				}
			}

			if testCase.Expected.DecodeErrorCode != "" {
				_, err := DecodeRawEmail(testCase.Event)
				var decodeErr *RawEmailDecodeError
				if !errors.As(err, &decodeErr) {
					t.Fatalf("%s: expected RawEmailDecodeError, got %v", testCase.Name, err)
				}
				if decodeErr.Code() != testCase.Expected.DecodeErrorCode {
					t.Fatalf("%s: unexpected error code %q", testCase.Name, decodeErr.Code())
				}
			}

			if testCase.Expected.VerifyDownload {
				verified, err := VerifyRawEmailDownload([]byte(testCase.DownloadBytesUTF8), testCase.Event)
				if err != nil {
					t.Fatalf("%s: VerifyRawEmailDownload returned error: %v", testCase.Name, err)
				}
				if string(verified) != testCase.DownloadBytesUTF8 {
					t.Fatalf("%s: unexpected verified content %q", testCase.Name, string(verified))
				}
			}
		}
	})
}
