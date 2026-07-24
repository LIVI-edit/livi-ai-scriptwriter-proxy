# Package 6 local quality runner

Runs only against saved, anonymized fixtures. It performs no network or OpenAI call, separates blocking contract violations from a non-final quality score, and writes JSON/Markdown when `PACKAGE6_QUALITY_OUTPUT_DIR` is set. The live-model benchmark is deliberately marked `PREPARED, NOT EXECUTED`.
