import fs from 'fs';
import path from 'path';

import { ConfidentialClientApplication } from '@azure/msal-node';
import axios from 'axios';

import { logger } from './logger.js';

const {
  AZURE_CLIENT_ID,
  AZURE_TENANT_ID,
  AZURE_CLIENT_SECRET,
  AZURE_MAILBOX,
} = process.env;

let msalClient: ConfidentialClientApplication | null = null;

function getMsalClient(): ConfidentialClientApplication {
  if (!msalClient) {
    if (!AZURE_CLIENT_ID || !AZURE_TENANT_ID || !AZURE_CLIENT_SECRET) {
      throw new Error('Azure credentials not configured (AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET)');
    }
    msalClient = new ConfidentialClientApplication({
      auth: {
        clientId: AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
        clientSecret: AZURE_CLIENT_SECRET,
      },
    });
  }
  return msalClient;
}

async function getToken(): Promise<string> {
  const result = await getMsalClient().acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  if (!result?.accessToken) throw new Error('Failed to acquire access token');
  return result.accessToken;
}

export interface EmailOptions {
  to: string;
  subject: string;
  body: string;
  attachmentPath?: string; // Absolute path on host
}

export async function sendEmail(opts: EmailOptions): Promise<void> {
  if (!AZURE_MAILBOX) {
    throw new Error('AZURE_MAILBOX not configured');
  }

  const token = await getToken();

  const message: Record<string, unknown> = {
    subject: opts.subject,
    body: { contentType: 'Text', content: opts.body },
    toRecipients: [{ emailAddress: { address: opts.to } }],
  };

  if (opts.attachmentPath) {
    const fileBuffer = fs.readFileSync(opts.attachmentPath);
    const fileName = path.basename(opts.attachmentPath);
    const contentBytes = fileBuffer.toString('base64');

    message.attachments = [
      {
        '@odata.type': '#microsoft.graph.fileAttachment',
        name: fileName,
        contentBytes,
      },
    ];

    logger.info({ fileName, size: fileBuffer.length }, 'Attaching file to email');
  }

  await axios.post(
    `https://graph.microsoft.com/v1.0/users/${AZURE_MAILBOX}/sendMail`,
    { message },
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    },
  );

  logger.info({ to: opts.to, subject: opts.subject, hasAttachment: !!opts.attachmentPath }, 'Email sent');
}
