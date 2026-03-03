# Andy — NanoClaw Personal AI Assistant

A self-hosted WhatsApp AI personal assistant built on [NanoClaw](https://github.com/anthropics/nanoclaw), integrated with Microsoft Outlook (Email + Calendar) and local Speech-to-Text via OpenAI Whisper.

> **"If a service has an API, Andy can access it."**

---

## Features

- 💬 **Natural Language Queries** — Ask anything, get answers on WhatsApp
- 📧 **Send Emails** — *"Send a mail to Vineet that meeting is at 3pm"*
- 📨 **Read Emails** — *"Show my last 5 emails"*
- 📅 **Schedule Meetings** — *"Book a meeting tomorrow at 10am called Team Sync"*
- 🗓️ **List Calendar Events** — Returns events with Teams meeting join links
- ❌ **Cancel Meetings** — *"Cancel my 3pm meeting"*
- 🎙️ **Voice Message Support** — Send a voice note → Whisper transcribes → Andy executes
- 👤 **Contact Name Resolution** — *"Send mail to Eega"* → resolves to eega.krishna@aionos.ai
- 👥 **Multi-User Support** — Each user gets an isolated workspace

---

## Architecture

```
WhatsApp Message / Voice Note
          │
          ▼
    NanoClaw (VM)
          │
          ▼
  Docker Container
  Claude Code SDK (Claude AI)
          │
          ▼
  ms-graph-mcp (Custom MCP Server)
          │
          ▼
  Microsoft Graph API
          │
          ▼
  Outlook Mail + Calendar
```

---

## Prerequisites

- Linux VM (Ubuntu 24 recommended)
- Python 3.x
- Node.js v20+
- Docker or Podman
- WhatsApp account
- Microsoft 365 account with mailbox
- Azure AD admin access (for app registration)
- Paid Anthropic API key

---

## Setup

### 1. Clone the Repository

```bash
git clone https://github.com/your-org/your-repo.git
cd your-repo
```

### 2. Create Python Virtual Environment

```bash
python3 -m venv nanoclaw-venv
source nanoclaw-venv/bin/activate
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Configure Environment Variables

Create a `.env` file in the project root:

```env
ANTHROPIC_API_KEY=sk-ant-your-key-here
AZURE_CLIENT_ID=your-application-client-id
AZURE_TENANT_ID=your-directory-tenant-id
AZURE_CLIENT_SECRET=your-client-secret-value
AZURE_MAILBOX=your-email@yourorg.com
```

### 5. Install MCP Server Dependencies

```bash
cd ms-graph-mcp
npm install
cd ..
```

### 6. Install Whisper (Speech-to-Text)

```bash
pip install openai-whisper --break-system-packages
sudo apt-get install -y ffmpeg espeak
```

### 7. Authenticate WhatsApp

```bash
./start-nanoclaw.sh
./setup.sh
```

Scan the QR code with WhatsApp → Settings → Linked Devices → Link a Device.

### 8. Register Your WhatsApp Number

```bash
sqlite3 store/messages.db \
  "INSERT INTO registered_groups (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger) \
   VALUES ('91XXXXXXXXXX@s.whatsapp.net', 'main', 'main', '@Andy', datetime('now'), NULL, 1);"
```

### 9. Start NanoClaw

```bash
nohup ./start-nanoclaw.sh > logs/nanoclaw.log 2>&1 &
```

---

## Azure App Registration

### Required Permissions (Application — not Delegated)

| Permission | Purpose |
|---|---|
| `Mail.Send` | Send emails |
| `Mail.Read` | Read emails |
| `Mail.ReadWrite` | Read and manage emails |
| `Calendars.ReadWrite` | Create, read, delete calendar events |
| `MailboxSettings.Read` | Read mailbox settings |
| `User.Read.All` | Look up users by name |

> After adding permissions, click **Grant admin consent** in Azure Portal.

### Restrict Mailbox Access (Security)

Ask your IT admin to run in PowerShell:

```powershell
New-ApplicationAccessPolicy `
  -AppId "<CLIENT_ID>" `
  -PolicyScopeGroupId "your-email@yourorg.com" `
  -AccessRight RestrictAccess `
  -Description "Restrict NanoClaw to single mailbox"
```

Verify:
```powershell
Test-ApplicationAccessPolicy -AppId "<CLIENT_ID>" -Identity "your-email@yourorg.com"
# Expected: AccessCheckResult : Granted
```

---

## Project Structure

```
nanoclaw/
├── src/                        # NanoClaw host application
│   ├── index.ts                # Main orchestrator
│   ├── channels/whatsapp.ts    # WhatsApp connection + STT handler
│   ├── container-runner.ts     # Docker container management
│   └── config.ts               # Configuration
├── container/
│   ├── Dockerfile              # Agent container image
│   └── agent-runner/src/       # Claude Code agent runner
│       └── index.ts            # MCP server registration + tool config
├── ms-graph-mcp/               # Custom Microsoft Graph MCP server
│   └── index.js                # Email + Calendar tools
├── groups/
│   └── main/                   # Per-user workspace
│       ├── CLAUDE.md           # Agent instructions + contacts
│       ├── contacts.json       # Name to email mappings
│       └── .mcp.json           # MCP server config
├── store/
│   ├── auth/                   # WhatsApp session (do not commit)
│   └── messages.db             # SQLite message store
├── logs/                       # Application logs
└── .env                        # Credentials (do not commit)
```

---

## Adding New Users

```bash
# 1. Register their WhatsApp JID
sqlite3 store/messages.db \
  "INSERT INTO registered_groups (jid, name, folder, trigger_pattern, added_at, container_config, requires_trigger) \
   VALUES ('91XXXXXXXXXX@s.whatsapp.net', 'username', 'username', '@Andy', datetime('now'), NULL, 1);"

# 2. Create their workspace
mkdir -p groups/username
cp groups/main/CLAUDE.md groups/username/CLAUDE.md
cp groups/main/contacts.json groups/username/contacts.json
cp groups/main/.mcp.json groups/username/.mcp.json
```

---

## Adding New Tools

1. Add a new `server.tool()` block in `ms-graph-mcp/index.js`
2. Add required Graph API permission in Azure Portal and grant admin consent
3. Restart NanoClaw (no container rebuild needed)

For tools requiring new MCP servers, also update `allowedTools` and `mcpServers` in `container/agent-runner/src/index.ts` and rebuild the container:

```bash
./container/build.sh
```

---

## Usage Examples

Send these messages to your WhatsApp self-chat (prefix with `@Andy`):

```
@Andy what is today's date?
@Andy send a mail to vineet that the meeting is at 3pm
@Andy show my last 5 emails
@Andy book a meeting tomorrow at 10am called Team Sync ending at 10:30am
@Andy what's on my calendar this week?
@Andy cancel my 3pm meeting
```

Or send a **voice message** — Andy will transcribe and execute it automatically.

---

## Cost

| Component | Cost |
|---|---|
| NanoClaw | Free (open source) |
| Whisper STT | Free (local) |
| Microsoft Graph API | Free (included in M365) |
| Claude Sonnet API | ~$5–6 per 1,000 queries |
| Claude Haiku API | ~$1.5–2 per 1,000 queries |

> A paid **Anthropic API key is required**. Monitor token usage at [console.anthropic.com](https://console.anthropic.com).

---

## Security Considerations

- All WhatsApp data and credentials are stored **locally on your VM**
- Only conversation text is sent to Anthropic's API for processing
- Azure Application Access Policy restricts mailbox access to authorized users only
- Never commit `.env` or `store/auth/` to version control
- Rotate Azure client secret regularly
- Review data classification policy before sharing sensitive business information

---

## Troubleshooting

| Issue | Fix |
|---|---|
| Agent says "I don't have access" | Check `.mcp.json` in group folder, rebuild container |
| 403 from Graph API | Grant admin consent in Azure Portal |
| Roles: NONE in token | Admin consent not granted |
| Calendar/mail read failing | IT admin needs to configure Application Access Policy |
| Voice message not transcribed | Verify `ffmpeg` and `whisper` are installed |
| WhatsApp disconnected | Re-run `./setup.sh` and scan QR code |

---

## Built With

- [NanoClaw](https://github.com/anthropics/nanoclaw) — WhatsApp AI assistant framework
- [Claude Code SDK](https://docs.anthropic.com) — Anthropic AI agent SDK
- [Microsoft Graph API](https://graph.microsoft.com) — Microsoft 365 integration
- [OpenAI Whisper](https://github.com/openai/whisper) — Local speech-to-text
- [Baileys](https://github.com/WhiskeySockets/Baileys) — WhatsApp Web API
- [@azure/msal-node](https://github.com/AzureAD/microsoft-authentication-library-for-js) — Azure authentication

---

## License

NanoClaw is open source. See [LICENSE](LICENSE) for details.
This integration layer is built on top of NanoClaw and follows the same license.
