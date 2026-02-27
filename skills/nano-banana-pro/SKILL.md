---
name: nano-banana-pro
description: Generate or edit images using AI (Gemini 2.0 Flash). Use for "create an image of…", "edit this photo", or "generate a logo".
metadata:
  homepage: https://ai.google.dev/
  credential: credentials_tools.gemini_api_key
---

## Credential

Key: `credentials_tools.gemini_api_key` — check availability via `get_config credentials_tools.gemini_api_key`.

# Nano Banana Pro (Gemini 3 Pro Image)

Use the bundled script to generate or edit images.

API key: `/secret credentials_tools.gemini_api_key`

All commands run via `credential_exec`:

```
credential_exec({
  command: "uv run {baseDir}/scripts/generate_image.py --prompt \"your image description\" --filename \"output.png\" --resolution 1K",
  credentials: { "GEMINI_API_KEY": "credentials_tools.gemini_api_key" }
})
```

Edit (single image)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "edit instructions" --filename "output.png" -i "/path/in.png" --resolution 2K
```

Multi-image composition (up to 14 images)

```bash
uv run {baseDir}/scripts/generate_image.py --prompt "combine these into one scene" --filename "output.png" -i img1.png -i img2.png -i img3.png
```

Notes

- Resolutions: `1K` (default), `2K`, `4K`.
- Use timestamps in filenames: `yyyy-mm-dd-hh-mm-ss-name.png`.
- If the script prints a `MEDIA:` line, treat it as the output path.
- Do not read the image back; report the saved path only.
