from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "src" / "primitive_sdk" / "schemas" / "email_received_event.schema.json"
OUTPUT = ROOT / "src" / "primitive_sdk" / "models_generated.py"
def main() -> None:
    subprocess.run(
        [
            sys.executable,
            "-m",
            "datamodel_code_generator",
            "--input",
            str(SCHEMA),
            "--input-file-type",
            "jsonschema",
            "--output",
            str(OUTPUT),
            "--output-model-type",
            "pydantic_v2.BaseModel",
            "--snake-case-field",
            "--field-constraints",
            "--target-python-version",
            "3.11",
            "--disable-timestamp",
            "--use-annotated",
            "--use-union-operator",
            "--reuse-model",
            "--allow-extra-fields",
        ],
        check=True,
    )
    subprocess.run(["uv", "run", "--project", str(ROOT), "ruff", "check", "--fix", str(OUTPUT)], check=True)
    subprocess.run(["uv", "run", "--project", str(ROOT), "ruff", "format", str(OUTPUT)], check=True)


if __name__ == "__main__":
    main()
