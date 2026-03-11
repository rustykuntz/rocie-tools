---
name: gog-google-workspace-cli-for-gmail-drive-sheets-docs
description: Gmail, Calendar, Chat, Classroom, Drive, Docs, Slides, Sheets, Contacts, Tasks, People, Groups, Keep — all via gog CLI.
metadata:
  homepage: https://gogcli.sh
  dependencies:
    gog:
      description: gog CLI
      check: "gog --help"
      install: "brew install gogcli"
    gog-auth:
      description: Google OAuth credentials configured for gog
      check: "gog auth list"
      install: "gog auth credentials /path/to/client_secret.json && gog auth add you@gmail.com"
      interactive: [oauth, gcp-console]
---
# gog

CLI for Google Workspace: Gmail, Calendar, Chat, Classroom, Drive, Docs, Slides, Sheets, Contacts, Tasks, People, Groups, Keep. Requires OAuth setup.

## Browser-assisted setup (preferred)

Before asking the user to manually create credentials, check if Chrome has a logged-in Google account:
1. Open `https://accounts.google.com` in agent-browser and read who's signed in
2. If signed in: tell the user which account you found and ask for approval to use it for gog credentials
3. If approved: open GCP console, create a project (or reuse existing non-production one), create OAuth Desktop credentials, build client_secret.json, and run `gog auth credentials` + `gog auth add`
4. If not signed in: ask the user to log into Chrome first, or fall back to manual setup below

## Manual setup (fallback)

GCP project for client_secret.json (priority order):
1. Create a new dedicated project (e.g. "rocie-personal")
2. If creation is blocked, reuse an existing personal/dev project
3. Never use a production project — if only production projects exist, ask the user

```bash
gog auth credentials /path/to/client_secret.json
gog auth add you@gmail.com --services gmail,calendar,chat,classroom,drive,contacts,docs,slides,sheets,tasks,people
gog auth list
```

## Auth management

- `gog auth list` — list accounts
- `gog auth list --check` — verify tokens are usable
- `gog auth status` — show current auth state and services
- `gog auth alias set work work@company.com` — create alias
- Multiple OAuth clients: `gog --client work auth credentials ~/work.json`
- Scope control: `--readonly`, `--drive-scope full|readonly|file`, `--gmail-scope full|readonly`
- Add services later: `gog auth add you@gmail.com --services sheets --force-consent`

## Common commands

### Gmail
- Search (threads): `gog gmail search 'newer_than:7d' --max 10`
- Search (individual messages): `gog gmail messages search "in:inbox from:ryanair.com" --max 20`
- Send (plain): `gog gmail send --to a@b.com --subject "Hi" --body "Hello"`
- Send (multi-line): `gog gmail send --to a@b.com --subject "Hi" --body-file ./message.txt`
- Send (stdin): `gog gmail send --to a@b.com --subject "Hi" --body-file -`
- Send (HTML): `gog gmail send --to a@b.com --subject "Hi" --body-html "<p>Hello</p>"`
- Send (track opens): `gog gmail send --to a@b.com --subject "Hi" --body "Hello" --track`
- Draft: `gog gmail drafts create --to a@b.com --subject "Hi" --body-file ./message.txt`
- Send draft: `gog gmail drafts send <draftId>`
- Reply: `gog gmail send --to a@b.com --subject "Re: Hi" --body "Reply" --reply-to-message-id <msgId>`
- Labels: `gog gmail labels list`

### Calendar
- List calendars: `gog calendar calendars`
- List events: `gog calendar events <calendarId> --from <iso> --to <iso>`
- Create event: `gog calendar create <calendarId> --summary "Title" --from <iso> --to <iso>`
- Create with color: `gog calendar create <calendarId> --summary "Title" --from <iso> --to <iso> --event-color 7`
- Update event: `gog calendar update <calendarId> <eventId> --summary "New Title" --event-color 4`
- Delete event: `gog calendar delete <calendarId> <eventId>`
- Search events: `gog calendar search "query"`
- Free/busy: `gog calendar freebusy <calendarIds> --from <iso> --to <iso>`
- Show colors: `gog calendar colors` — IDs 1-11
- Focus time: `gog calendar focus-time --from <iso> --to <iso>`
- Out of office: `gog calendar out-of-office --from <iso> --to <iso>`

### Chat
- List spaces: `gog chat spaces list`
- Find space: `gog chat spaces find "name"`
- List messages: `gog chat messages list <space>`
- Send message: `gog chat messages send <space> --text "Hello"`
- DM someone: `gog chat dm send user@example.com --text "Hello"`

### Drive
- Search: `gog drive search "query" --max 10`
- List: `gog drive ls`
- Download: `gog drive download <fileId>`
- Upload: `gog drive upload ./file.txt`

### Contacts
- List: `gog contacts list --max 20`

### Sheets
- Get: `gog sheets get <sheetId> "Tab!A1:D10" --json`
- Update: `gog sheets update <sheetId> "Tab!A1:B2" --values-json '[["A","B"],["1","2"]]' --input USER_ENTERED`
- Append: `gog sheets append <sheetId> "Tab!A:C" --values-json '[["x","y","z"]]' --insert INSERT_ROWS`
- Clear: `gog sheets clear <sheetId> "Tab!A2:Z"`
- Metadata: `gog sheets metadata <sheetId> --json`

### Docs
- Cat: `gog docs cat <docId>`
- Export: `gog docs export <docId> --format txt --out /tmp/doc.txt`
- Info: `gog docs info <docId>`
- Create: `gog docs create "Title"`
- Write (append): `gog docs write <docId> "new content"`
- Write (overwrite): `gog docs write <docId> "new content" --replace`
- Insert at position: `gog docs insert <docId> "text" --index 1`
- Delete range: `gog docs delete <docId> --start 1 --end 10`
- Find & replace: `gog docs find-replace <docId> "old" "new"`

### Slides
- Create: `gog slides create "Deck Title"`
- Create from markdown: `gog slides create-from-markdown "Title" --content-file slides.md`
- Export: `gog slides export <presentationId> --format pdf --out /tmp/deck.pdf`
- Info: `gog slides info <presentationId>`
- List slides: `gog slides list-slides <presentationId>`
- Add slide with image: `gog slides add-slide <presentationId> image.png`

### Tasks
- List task lists: `gog tasks lists list`
- Create task list: `gog tasks lists create "List Name"`
- List tasks: `gog tasks list <taskListId>`
- Add task: `gog tasks add <taskListId> --title "Do thing"`
- Complete task: `gog tasks done <taskListId> <taskId>`
- Delete task: `gog tasks delete <taskListId> <taskId>`

### People
- My profile: `gog people me`
- Get user: `gog people get <userId>`
- Search: `gog people search "query"`

### Groups
- List groups: `gog groups list`
- List members: `gog groups members <groupEmail>`

### Classroom
- List courses: `gog classroom courses list`
- Get course: `gog classroom courses get <courseId>`
- List students: `gog classroom students list <courseId>`
- List coursework: `gog classroom coursework list <courseId>`

### Keep (Workspace only, requires service account)
- List notes: `gog keep list`
- Get note: `gog keep get <noteId>`
- Search notes: `gog keep search "query"`

## Email formatting

- Prefer plain text. Use `--body-file` for multi-paragraph messages (or `--body-file -` for stdin).
- Same `--body-file` pattern works for drafts and replies.
- `--body` does not unescape `\n`. For inline newlines use a heredoc or `$'Line 1\n\nLine 2'`.
- Use `--body-html` only when rich formatting is needed.
- HTML tags: `<p>`, `<br>`, `<strong>`, `<em>`, `<a href="url">`, `<ul>`/`<li>`.

## Notes

- Set `GOG_ACCOUNT=you@gmail.com` to avoid repeating `--account`.
- For scripting, prefer `--json` plus `--no-input`. Also available: `--plain` (TSV output).
- Sheets values via `--values-json` (recommended) or inline rows.
- Confirm before sending mail or creating events.
- `gog gmail search` returns threads; `gog gmail messages search` returns individual emails.
- Run `gog <group> --help` to discover subcommands not listed here.
