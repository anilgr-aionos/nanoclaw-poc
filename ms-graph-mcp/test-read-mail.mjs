
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

// Decode token to see actual scopes

const payload = JSON.parse(Buffer.from(accessToken.split('.')[1], 'base64').toString());

console.log('Granted roles:', payload.roles);

// Try reading inbox

try {

  const r = await axios.get(

    `https://graph.microsoft.com/v1.0/users/${AZURE_MAILBOX}/messages?$top=3&$select=subject,from,receivedDateTime`,

    { headers: { Authorization: `Bearer ${accessToken}` } }

  );

  console.log('✅ Mail read OK:');

  r.data.value.forEach(m => console.log(' -', m.subject, '|', m.from.emailAddress.address));

} catch(e) {

  console.error('❌ Mail read failed:');

  console.error(JSON.stringify(e.response?.data, null, 2));

}

