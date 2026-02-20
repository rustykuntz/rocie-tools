---
name: tauri-cli-api
description: Tauri app and plugin lifecycle via the official CLI — init, dev, build, bundle, mobile (Android/iOS), plugins, permissions, capabilities, icons, signing, and diagnostics.
metadata:
  homepage: https://tauri.app
  dependencies:
    tauri:
      description: Tauri CLI
      check: "tauri --version"
      install: "npm install --save-dev @tauri-apps/cli@latest"
---


# Tauri CLI

Use `tauri` for the full lifecycle of a Tauri app or plugin: initialization, development, production builds, bundling, mobile targets, permissions, plugins, signing, and diagnostics.

Do / Don't

- Do prefer existing `tauri.conf.json` values over CLI overrides.
- Do use explicit flags — don't infer dev host, ports, runner binary, platform, or ABI targets.
- Do confirm before destructive actions (`--force`, `rm`, overwrite).
- Don't invent flags or commands not in the Tauri CLI.
- Don't use `--ci` unless user mentions CI or automation.

Initialize a project

- `tauri init`
  - `--force` overwrites existing `src-tauri`
  - `--ci` disables interactive prompts
  - `--directory <dir>` targets a specific folder

Development mode

- `tauri dev`
- Release dev build: `tauri dev --release`
- Custom config merge: `tauri dev -c tauri.staging.conf.json`
- Pass runner and app args: `tauri dev -- --runnerArgs -- appArgs`
- Don't assume dev server host, ports, or runner binary.

Build and bundle

- `tauri build` — builds **and** bundles the app
- `tauri bundle` — bundles an **already-built** app (no compile)
- Don't skip signing or bundling unless the user asks.
- Don't change targets unless specified.

Mobile targets

- Android: `tauri android init` → `dev` / `build` / `run`
  - Always `init` before `dev`/`build`/`run`
  - `--open` only when user explicitly wants Android Studio
  - Don't assume ABI targets (`--target`) or split APK settings
- iOS (macOS only): `tauri ios init` → `dev` / `build` / `run`
  - Physical devices require a public dev host
  - Don't invent `--export-method` values
  - Prefer defaults unless explicitly overridden

Plugin management

- Create new plugin: `tauri plugin new my-plugin`
- Init in existing directory: `tauri plugin init`
- Optional flags (only when requested): `--no-api`, `--android`, `--ios`, `--mobile`, `--ios-framework spm|xcode`
- Plugin mobile init: `tauri plugin android init`, `tauri plugin ios init`
  - Plugin name must match directory name

Permissions and capabilities

- Permissions: `tauri permission new`, `add`, `rm`, `ls`
  - Default format: `json` unless overridden
  - Confirm before deleting permissions
- Capabilities: `tauri capability new`
  - Only create when user explicitly asks for window scoping or permission grouping

Icons

- `tauri icon [./app-icon.png]`
  - Defaults to `./app-icon.png` if no input given
  - Don't override background colors unless specified

Signing

- `tauri signer generate` — create a new signing key pair
- `tauri signer sign` — sign a bundle
- Private keys are sensitive — never echo passwords, prefer env vars for key paths.

Diagnostics and migration

- `tauri info` — environment check (use for build failures, version mismatches, CI debugging)
- `tauri migrate` — only when user explicitly asks; warns that config and code may change

Examples

- "Initialize a Tauri app in this repo" → `tauri init`
- "Run Tauri dev in release mode" → `tauri dev --release`
- "Build Android APKs only" → `tauri android build --apk true --aab false`
- "Create a new plugin without TS API" → `tauri plugin new my-plugin --no-api`
- "List permissions for a plugin" → `tauri permission ls my-plugin`
