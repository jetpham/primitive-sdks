# `github.com/primitivedotdev/primitive-sdks/sdk-go`

Official Primitive Go SDK for webhook verification and validation.

This package helps you:

- verify Primitive webhook signatures
- parse webhook request bodies
- validate webhook payloads against the canonical JSON schema
- work with typed `email.received` events in Go

## Installation

```bash
go get github.com/primitivedotdev/primitive-sdks/sdk-go
```

## Basic Usage

```go
package main

import (
	"log"

	primitive "github.com/primitivedotdev/primitive-sdks/sdk-go"
)

func handle(body []byte, headers map[string]string) {
	event, err := primitive.HandleWebhook(primitive.HandleWebhookOptions{
		Body:    body,
		Headers: headers,
		Secret:  "whsec_...",
	})
	if err != nil {
		log.Fatal(err)
	}

	log.Println("Email from:", event.Email.Headers.From)
	log.Println("Subject:", deref(event.Email.Headers.Subject))
}

func deref(value *string) string {
	if value == nil {
		return ""
	}
	return *value
}
```

## Development

From `primitive-sdks/sdk-go`:

```bash
python scripts/generate_schema_module.py
go test ./...
go test -run TestSharedCompatibilityFixtures ./...
gofmt -w .
```

If you use Nix, from `primitive-sdks/`:

```bash
nix develop
```
