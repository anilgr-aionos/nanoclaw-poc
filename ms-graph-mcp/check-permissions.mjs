import { ConfidentialClientApplication } from '@azure/msal-node';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config({ path: '/home/gr_anil/nanoclaw-poc/nanoclaw/.env' });

const { AZURE_CLIENT_ID, AZURE_TENANT_ID, AZURE_CLIENT_SECRET, AZURE_MAILBOX } = process.env;

const msalClient = new ConfidentialClientApplication({
  auth: {
    clientId: AZURE_CLIENT_ID,
    authority: `https://login.microsoftonline.com/${AZURE_TENANT_ID}`,
    clientSecret: AZURE_CLIENT_SECRET,
  },
});

const result = await msalClient.acquireTokenByClientCredential({
  scopes: ['https://graph.microsoft.com/.default'],
});

// Decode JWT to see actual granted permissions
const payload = JSON.parse(Buffer.from(result.accessToken.split('.')[1], 'base64').toString());
console.log('Roles (granted permissions):', JSON.stringify(payload.roles, null, 2) || 'NONE');

// Try user lookup
try {
  const r = await axios.get(
    `https://graph.microsoft.com/v1.0/users/${AZURE_MAILBOX}`,
    { headers: { Authorization: `Bearer ${result.accessToken}` } }
  );
  console.log('✅ User lookup OK:', r.data.displayName, r.data.mail);
} catch(e) {
  console.error('❌ User lookup failed:', JSON.stringify(e.response?.data, null, 2));
}
