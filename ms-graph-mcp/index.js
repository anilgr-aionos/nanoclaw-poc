import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { ConfidentialClientApplication } from "@azure/msal-node";
import axios from "axios";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load .env from your nanoclaw folder
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

const {
  AZURE_CLIENT_ID,
  AZURE_TENANT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_MAILBOX,
} = process.env;

// MSAL client credentials setup
const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    clientSecret: AZURE_CLIENT_SECRET,
  },
});

async function getToken() {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ["https://graph.microsoft.com/.default"],
  });
  return result.accessToken;
}

async function graphRequest(method, endpoint, data = null) {
  const token = await getToken();
  const response = await axios({
    method,
    url: `https://graph.microsoft.com/v1.0${endpoint}`,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    data,
  });
  return response.data;
}

// MCP Server
const server = new McpServer({
  name: "ms-graph-mcp",
  version: "1.0.0",
});

// Tool: Send Email
server.tool(
  "send_email",
  {
    to: z.string().email().describe("Recipient email address"),
    subject: z.string().describe("Email subject"),
    body: z.string().describe("Email body (plain text)"),
  },
  async ({ to, subject, body }) => {
    await graphRequest("POST", `/users/${AZURE_MAILBOX}/sendMail`, {
      message: {
        subject,
        body: { contentType: "Text", content: body },
        toRecipients: [{ emailAddress: { address: to } }],
      },
    });
    return { content: [{ type: "text", text: `Email sent to ${to}` }] };
  }
);

// Tool: Create Calendar Event
server.tool(
  "create_calendar_event",
  {
    title: z.string().describe("Event title/subject"),
    start: z.string().describe("Start datetime in ISO 8601, e.g. 2026-02-28T10:00:00"),
    end: z.string().describe("End datetime in ISO 8601, e.g. 2026-02-28T11:00:00"),
    timezone: z.string().default("Asia/Kolkata").describe("IANA timezone"),
    body: z.string().optional().describe("Event description"),
    attendees: z.array(z.string().email()).optional().describe("Attendee email list"),
  },
  async ({ title, start, end, timezone, body, attendees }) => {
    const event = {
      subject: title,
      start: { dateTime: start, timeZone: timezone },
      end: { dateTime: end, timeZone: timezone },
      body: { contentType: "Text", content: body || "" },
      attendees: (attendees || []).map((email) => ({
        emailAddress: { address: email },
        type: "required",
      })),
    };
    const result = await graphRequest(
      "POST",
      `/users/${AZURE_MAILBOX}/calendar/events`,
      event
    );
    return {
      content: [
        {
          type: "text",
          text: `Event "${result.subject}" created. ID: ${result.id}`,
        },
      ],
    };
  }
);

// Tool: List Upcoming Calendar Events
server.tool(
  'list_calendar_events',
  {
    days: z.number().default(7).describe('Number of days ahead to look'),
  },
  async ({ days }) => {
    const now = new Date().toISOString();
    const future = new Date(Date.now() + days * 86400000).toISOString();
    const data = await graphRequest(
      'GET',
      `/users/${AZURE_MAILBOX}/calendarView?startDateTime=${now}&endDateTime=${future}&$orderby=start/dateTime&$top=10&$select=subject,start,end,location,onlineMeeting,onlineMeetingUrl,bodyPreview,organizer,attendees`
    );
    const events = data.value.map((e) => {
      const start = new Date(e.start.dateTime).toLocaleString('en-IN', { timeZone: e.start.timeZone });
      const end = new Date(e.end.dateTime).toLocaleString('en-IN', { timeZone: e.end.timeZone });
      const meetingLink = e.onlineMeeting?.joinUrl || e.onlineMeetingUrl || null;
      const location = e.location?.displayName || null;
      const organizer = e.organizer?.emailAddress?.address || null;
      const attendees = (e.attendees || []).map(a => a.emailAddress?.address).filter(Boolean).join(', ');

      let entry = `📅 ${e.subject}\n   🕐 ${start} → ${end}`;
      if (location) entry += `\n   📍 ${location}`;
      if (organizer) entry += `\n   👤 Organizer: ${organizer}`;
      if (attendees) entry += `\n   👥 Attendees: ${attendees}`;
      if (meetingLink) entry += `\n   🔗 Join: ${meetingLink}`;
      return entry;
    });
    return {
      content: [{
        type: 'text',
        text: events.length ? events.join('\n\n') : 'No upcoming events.'
      }]
    };
  }
);
server.tool(
  'read_emails',
  {
    count: z.number().default(5).describe('Number of recent emails to fetch'),
    folder: z.string().default('inbox').describe('Folder: inbox, sentitems, drafts'),
  },
  async ({ count, folder }) => {
    const data = await graphRequest(
      'GET',
      `/users/${AZURE_MAILBOX}/mailFolders/${folder}/messages?$top=${count}&$orderby=receivedDateTime desc&$select=subject,from,receivedDateTime,bodyPreview,isRead`
    );
    const emails = data.value.map((e, i) =>
      `${i + 1}. ${e.isRead ? '' : '🔵 '}From: ${e.from.emailAddress.address}\n   Subject: ${e.subject}\n   Date: ${new Date(e.receivedDateTime).toLocaleString()}\n   Preview: ${e.bodyPreview?.slice(0, 100)}`
    );
    return {
      content: [{ type: 'text', text: emails.length ? emails.join('\n\n') : 'No emails found.' }]
    };
  }
);

// Start server
const transport = new StdioServerTransport();
await server.connect(transport);
