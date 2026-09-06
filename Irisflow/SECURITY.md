# Security

Iris Flow is a local Mac app. **API keys never belong in this git repo.**

## How keys are stored

Keys pasted in the app are encrypted with Electron `safeStorage` (macOS Keychain) and written only under:

`~/Library/Application Support/Iris/secrets.enc`

(The on-disk folder is still named `Iris` so existing keys and chats stay put after the product rename to Iris Flow.)

Preferences (mode, model names) live in `iris.db` in that same folder. Neither file is in the project directory, so `git add` / pull requests cannot pick them up.

Do not add a project `.env` with real keys. That is the usual way secrets leak in open-source Electron apps.

## For contributors

- Never commit `.env`, `secrets.enc`, `iris.db`, logs, `dist/`, or `release/`.
- GitHub secret scanning should reject accidental key pastes in code. If that happens, rotate the key at the provider.
- The old Supabase anon key lived in git history of an earlier login build. That login path is removed. If you still have that Supabase project, rotate its keys.

## What is safe to commit

App source, icons, the Apple Silicon key-listener binary, and docs. No user credentials.
