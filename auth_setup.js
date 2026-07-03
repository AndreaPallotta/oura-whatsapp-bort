const fs = require('fs');
const http = require('http');
const crypto = require('crypto');
const querystring = require('querystring');
const axios = require('axios');
const config = {
  ...require('./config'),
  validateConfig: require('./config').validateConfig
};

const PORT = 8080;
const REDIRECT_URI = `http://localhost:${PORT}/callback`;

let stateData = {};

function runLocalServer(state, resolve, reject) {
  stateData.state = state;
  
  const server = http.createServer(async (req, res) => {
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    
    if (reqUrl.pathname === '/callback') {
      const code = reqUrl.searchParams.get('code');
      const stateReceived = reqUrl.searchParams.get('state');
      
      if (stateReceived !== stateData.state) {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Error: State mismatch. Possible CSRF attack.');
        return;
      }
      
      if (code) {
        stateData.code = code;
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`
          <html>
          <head><title>Oura Authorization Successful</title></head>
          <body style="font-family: Arial, sans-serif; text-align: center; padding-top: 50px; background-color: #f4f7f6;">
              <div style="display: inline-block; background: white; padding: 40px; border-radius: 8px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                  <h2 style="color: #4CAF50;">Authorization Successful!</h2>
                  <p>You can close this tab and return to the terminal.</p>
              </div>
          </body>
          </html>
        `);
        server.close();
        resolve(code);
      } else {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Error: Authorization code not received.');
        server.close();
        reject(new Error('Authorization code not received'));
      }
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not Found');
    }
  });

  server.listen(PORT, () => {
    console.log(`Waiting for redirect on ${REDIRECT_URI} ...`);
  });
}

async function main() {
  console.log("=== Oura Ring Initial Authentication Setup (Node.js) ===");
  config.validateConfig(true);
  
  const state = crypto.randomBytes(16).toString('hex');
  const scopes = "personal daily sleep stress";
  
  const params = {
    client_id: config.OURA_CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "code",
    scope: scopes,
    state: state
  };
  
  const authUrl = "https://cloud.ouraring.com/oauth/authorize?" + querystring.stringify(params);
  
  console.log("\n1. Open the following URL in your browser and authorize the app:\n");
  console.log(authUrl);
  console.log("\n2. Log in and click 'Authorize'. You will be redirected to localhost.");
  
  try {
    const code = await new Promise((resolve, reject) => {
      runLocalServer(state, resolve, reject);
    });
    
    console.log("\nAuthorization code received. Exchanging for access and refresh tokens...");
    
    const tokenUrl = "https://api.ouraring.com/oauth/token";
    const payload = querystring.stringify({
      grant_type: "authorization_code",
      code: code,
      redirect_uri: REDIRECT_URI,
      client_id: config.OURA_CLIENT_ID,
      client_secret: config.OURA_CLIENT_SECRET
    });
    
    const response = await axios.post(tokenUrl, payload, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      }
    });
    
    const tokens = response.data;
    
    const stateDataToSave = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      last_sent_date: "1970-01-01"
    };
    
    fs.writeFileSync(config.STATE_FILE, JSON.stringify(stateDataToSave, null, 4), 'utf8');
    
    console.log(`\nSuccess! Tokens successfully saved to ${config.STATE_FILE}`);
    console.log("You can now copy this folder (including state.json) to your phone!");
    
  } catch (error) {
    console.error("\nError during setup:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
  }
}

main();
