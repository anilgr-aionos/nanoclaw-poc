import { ConfidentialClientApplication } from '@azure/msal-node';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: '/home/gr_anil/nanoclaw-poc/nanoclaw/.env' });

const { AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, AZURE_MAILBOX } = process.env;
console.log('Client ID:', AZURE_CLIENT_ID?.slice(0,8) + '...');
console.log('Tenant ID:', AZURE_TENANT_ID?.slice(0,8) + '...');
console.log('Mailbox:', AZURE_MAILBOX);

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    clientSecret: AZURE_CLIENT_SECRET,
  },
});

try {
  const result = await msalClient.acquireTokenByClientCredential({
    scopes: ['https://graph.microsoft.com/.default'],
  });
  console.log('✅ Token acquired');

  const response = await axios.get(
    `https://graph.microsoft.com/v1.0/users/${AZURE_MAILBOX}/calendar`,
    { headers: { Authorization: `Bearer ${result.accessToken}` } }
  );
  console.log('✅ Calendar OK:', response.data.name);
} catch (err) {
  console.error('❌ Error:', JSON.stringify(err.response?.data || err.message, null, 2));
}
