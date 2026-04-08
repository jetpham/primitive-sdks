from __future__ import annotations

import subprocess
import sys
from os import environ
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCHEMA = ROOT / "src" / "primitive_sdk" / "schemas" / "email_received_event.schema.json"
OUTPUT = ROOT / "src" / "primitive_sdk" / "models_generated.py"


def _run_ruff(*args: str) -> None:
    for entry in environ.get("PATH", "").split(":"):
        candidate = Path(entry) / "ruff"
        if not candidate.exists():
            continue
        if ROOT / ".venv" in candidate.parents:
            continue
        subprocess.run([str(candidate), *args], check=True)
        return
    subprocess.run([sys.executable, "-m", "ruff", *args], check=True)


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
    _run_ruff("check", "--fix", str(OUTPUT))
    _run_ruff("format", str(OUTPUT))


if __name__ == "__main__":
    main()
