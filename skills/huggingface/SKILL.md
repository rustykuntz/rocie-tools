---
name: huggingface
description: Download and upload models and datasets, manage repos, search, and run inference on Hugging Face. Use for "download llama model", "upload my dataset", or "search HF for…".

metadata:
  homepage: https://huggingface.co/docs/huggingface_hub/en/guides/cli
  dependencies:
    hf:
      description: Hugging Face Hub CLI
      check: "hf version"
      install: "pip install -U huggingface_hub[cli]"
---

# Hugging Face Hub CLI (`hf`)

CLI for downloading models/datasets, uploading files, managing repos, running jobs, and browsing the Hugging Face Hub.

## Authentication

Most read operations work without auth. Gated models, private repos, uploads, and repo management require a token.

```bash
# Check current login
hf auth whoami

# Login (interactive — prompts for token)
hf auth login

# Login non-interactively
hf auth login --token $HF_TOKEN

# List stored tokens
hf auth list

# Switch between tokens
hf auth switch --token-name my-token

# Logout
hf auth logout
```

Tokens are generated at https://huggingface.co/settings/tokens. For CI/automation, set the `HF_TOKEN` environment variable or pass `--token` to individual commands.

## Downloading

The most common operation. Downloads go to the HF cache (`~/.cache/huggingface/hub`) by default.

```bash
# Download entire model repo
hf download meta-llama/Llama-3.2-1B-Instruct

# Download specific files
hf download meta-llama/Llama-3.2-1B-Instruct config.json tokenizer.json

# Download with glob include/exclude
hf download meta-llama/Llama-3.2-1B-Instruct --include "*.safetensors" --exclude "*.bin"

# Download to a specific local directory (flat copy, not symlinked cache)
hf download meta-llama/Llama-3.2-1B-Instruct --local-dir ./models/llama

# Download a dataset
hf download HuggingFaceFW/fineweb --repo-type dataset

# Download a specific revision/branch
hf download meta-llama/Llama-3.2-1B-Instruct --revision main

# Dry run — show what would be downloaded without downloading
hf download meta-llama/Llama-3.2-1B-Instruct --dry-run

# Quiet mode — only print the path to downloaded files
hf download meta-llama/Llama-3.2-1B-Instruct --quiet
```

Key options:
- `--repo-type [model|dataset|space]` — defaults to `model`
- `--revision TEXT` — branch, tag, or commit hash
- `--include / --exclude` — glob patterns for filtering files
- `--local-dir TEXT` — download to a specific directory instead of cache
- `--force-download` — re-download even if cached
- `--max-workers N` — parallel download threads (default 8)
- `--quiet` — suppress progress bars

## Uploading

```bash
# Upload entire current directory to a model repo (creates repo if needed)
hf upload my-cool-model . .

# Upload a single file
hf upload username/my-model ./model.safetensors

# Upload to a dataset repo
hf upload username/my-dataset ./data /train --repo-type dataset

# Upload with commit message
hf upload username/my-model ./models . --commit-message "Epoch 34/50" --commit-description "Val accuracy: 68%"

# Upload as a pull request
hf upload bigcode/the-stack . . --repo-type dataset --create-pr

# Upload with file filtering
hf upload my-model . . --include "*.safetensors" --exclude "*.bin"

# Auto-create private repo if it doesn't exist
hf upload my-model . . --private
```

Key options:
- `REPO_ID` (required), `[LOCAL_PATH]` (default: `.`), `[PATH_IN_REPO]` (default: relative path)
- `--repo-type [model|dataset|space]`
- `--include / --exclude / --delete` — glob patterns
- `--commit-message / --commit-description`
- `--create-pr` — upload as PR instead of direct commit
- `--revision TEXT` — target branch
- `--every FLOAT` — schedule background commits every N minutes
- `--private` — create private repo if it doesn't exist

### Large folder uploads (resumable)

For very large uploads that may be interrupted:

```bash
hf upload-large-folder username/my-model ./large_model_dir
hf upload-large-folder username/my-model ./large_model_dir --revision v1.0
```

This uses a resumable protocol — safe to interrupt and restart.

## Searching & Browsing the Hub

### Models

```bash
# List top models by downloads
hf models ls --sort downloads --limit 10

# Search models
hf models ls --search "llama" --author meta-llama

# Get info about a specific model
hf models info meta-llama/Llama-3.2-1B-Instruct

# Get expanded info (downloads, likes, tags, etc.)
hf models info gpt2 --expand downloads,likes,tags

# JSON output
hf models ls --format json

# Quiet mode — only print model IDs
hf models ls --quiet
```

### Datasets

```bash
hf datasets ls --sort downloads --limit 10
hf datasets ls --search "code"
hf datasets info HuggingFaceFW/fineweb
hf datasets info my-dataset --expand downloads,likes,tags
```

### Spaces

```bash
hf spaces ls --limit 10
hf spaces ls --search "chatbot" --author huggingface
hf spaces info enzostvs/deepsite
hf spaces info gradio/theme_builder --expand sdk,runtime,likes
```

### Papers

```bash
hf papers ls
hf papers ls --sort trending
hf papers ls --date 2025-01-23
```

Common list options: `--search`, `--author`, `--filter`, `--sort`, `--limit`, `--format [table|json]`, `--quiet`, `--expand`.

## Repository Management

### Create / delete repos

```bash
# Create a model repo
hf repo create my-model

# Create a private dataset repo
hf repo create my-dataset --repo-type dataset --private

# Delete a repo (irreversible!)
hf repo delete my-model

# Move a repo between namespaces
hf repo move old-namespace/my-model new-namespace/my-model

# Update settings
hf repo settings my-model --private
hf repo settings my-model --gated auto
```

### Branches

```bash
hf repo branch create my-model dev
hf repo branch create my-model dev --revision abc123
hf repo branch delete my-model dev
```

### Tags

```bash
hf repo tag create my-model v1.0
hf repo tag create my-model v1.0 -m "First release"
hf repo tag delete my-model v1.0
hf repo tag list my-model
```

### File management

```bash
# Delete files from a repo
hf repo-files delete my-model file.txt
hf repo-files delete my-model "*.json"
hf repo-files delete my-model folder/
```

## Cache Management

Downloaded files are cached locally. Use these commands to inspect and clean up.

```bash
# List cached repos (sorted by size)
hf cache ls

# List with revision details
hf cache ls --revisions

# Filter large cached repos
hf cache ls --filter "size>1GB" --limit 20

# JSON output
hf cache ls --format json

# Remove a specific cached repo
hf cache rm model/gpt2
hf cache rm model/gpt2 --yes

# Dry run before removing
hf cache rm model/gpt2 --dry-run

# Prune detached/orphaned revisions
hf cache prune
hf cache prune --dry-run

# Verify cached files match remote checksums
hf cache verify gpt2
hf cache verify my-dataset --repo-type dataset
```

## Jobs (Remote Compute)

Run Docker-based jobs on Hugging Face infrastructure.

```bash
# Run a simple job
hf jobs run python:3.12 python -c 'print("Hello!")'

# Run with environment variables
hf jobs run -e FOO=foo python:3.12 python script.py

# Run with secrets (e.g., HF token)
hf jobs run --secrets HF_TOKEN python:3.12 python script.py

# Run on GPU hardware
hf jobs run --flavor a10g-small python:3.12 python train.py

# Run detached (background)
hf jobs run -d python:3.12 python long_job.py

# List running jobs
hf jobs ps

# List all jobs (including completed)
hf jobs ps -a

# View logs
hf jobs logs <job_id>

# Inspect job details
hf jobs inspect <job_id>

# Cancel a job
hf jobs cancel <job_id>

# View resource usage stats
hf jobs stats <job_id>

# List available hardware flavors
hf jobs hardware
```

### UV scripts (Python with inline deps)

```bash
hf jobs uv run my_script.py
hf jobs uv run ml_training.py --flavor a10g-small
hf jobs uv run --with transformers train.py
```

### Scheduled jobs

```bash
# Schedule a daily job (cron syntax)
hf jobs scheduled run "0 0 * * *" python:3.12 python script.py

# Schedule a UV script
hf jobs scheduled uv run "0 0 * * *" script.py --with pandas

# List scheduled jobs
hf jobs scheduled ps

# Suspend / resume / delete scheduled jobs
hf jobs scheduled suspend <id>
hf jobs scheduled resume <id>
hf jobs scheduled delete <id>
```

Hardware flavors: `cpu-basic`, `cpu-upgrade`, `cpu-xl`, `zero-a10g`, `t4-small`, `t4-medium`, `l4x1`, `l4x4`, `l40sx1`, `l40sx4`, `l40sx8`, `a10g-small`, `a10g-large`, `a10g-largex2`, `a10g-largex4`, `a100-large`, `a100x4`, `a100x8`.

## Inference Endpoints

Deploy and manage dedicated inference endpoints.

```bash
# List endpoints
hf endpoints ls
hf endpoints ls --namespace my-org

# Deploy from catalog (easiest)
hf endpoints catalog deploy --repo meta-llama/Llama-3.2-1B-Instruct

# Deploy custom endpoint
hf endpoints deploy my-endpoint --repo gpt2 --framework pytorch \
  --accelerator cpu --instance-size x4 --instance-type intel-icl \
  --region us-east-1 --vendor aws

# Describe an endpoint
hf endpoints describe my-endpoint

# Pause / resume / scale-to-zero
hf endpoints pause my-endpoint
hf endpoints resume my-endpoint
hf endpoints scale-to-zero my-endpoint

# Update endpoint settings
hf endpoints update my-endpoint --min-replica 2

# Delete endpoint
hf endpoints delete my-endpoint

# List catalog models
hf endpoints catalog ls
```

## Collections

Curate lists of models, datasets, spaces, and papers.

```bash
# List collections
hf collections ls
hf collections ls --owner nvidia

# Create a collection
hf collections create "My Models"
hf collections create "My Models" --description "Favorites" --private

# Get collection info
hf collections info username/my-collection-slug

# Add items
hf collections add-item username/my-collection meta-llama/Llama-3.2-1B model
hf collections add-item username/my-collection my-dataset dataset --note "Useful"

# Update collection metadata
hf collections update username/my-collection --title "New Title"

# Delete
hf collections delete username/my-collection
```

## Environment & Version

```bash
# Print environment info (Python version, installed packages, cache dir, etc.)
hf env

# Print CLI version
hf version
```

## Useful global patterns

- `--token TEXT` — override auth token for any command
- `--repo-type [model|dataset|space]` — defaults to `model` everywhere
- `--revision TEXT` — target a specific branch/tag/commit
- `--format json` — machine-readable output (on list commands)
- `--quiet` — minimal output, IDs only
- `--yes` / `-y` — skip confirmation prompts (for destructive operations)
