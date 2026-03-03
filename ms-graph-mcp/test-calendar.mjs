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

const { accessToken } = await msalClient.acquireTokenByClientCredential({
  scopes: ['https://graph.microsoft.com/.default'],
});
const headers = { Authorization: `Bearer ${accessToken}` };

// Test 1: Basic calendar access
try {
  const r = await axios.get(
    `https://graph.microsoft.com/v1.0/users/${AZURE_MAILBOX}/calendar`,
    { headers }
  );
  console.log('✅ Calendar access OK:', r.data.name);
} catch(e) {
  console.error('❌ Calendar access failed:');
  console.error(JSON.stringify(e.response?.data, null, 2));
}

// Test 2: CalendarView
try {
  const now = new Date().toISOString();
  const future = new Date(Date.now() + 7*86400000).toISOString();
  const r = await axios.get(
    `https://graph.microsoft.com/v1.0/users/${AZURE_MAILBOX}/calendarView?startDateTime=${now}&endDateTime=${future}&$top=5`,
    { headers }
  );
  console.log('✅ CalendarView OK, events found:', r.data.value.length);
  r.data.value.forEach(e => console.log(' -', e.subject, e.start.dateTime));
} catch(e) {
  console.error('❌ CalendarView failed:');
  console.error(JSON.stringify(e.response?.data, null, 2));
}
