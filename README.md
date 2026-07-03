# Oura Ring to WhatsApp Automation

A scheduled daily automation that fetches Oura Ring health metrics (Sleep, Readiness, Stress, Heart Rate, HRV, Respiration, Temperature Deviation) from the Oura API and sends a formatted status report to a recipient directly from your **personal WhatsApp account** (via a companion WhatsApp Web device).

---

## Step 1: Oura Developer App Setup

To connect to Oura:
1. Follow the official [Oura API Documentation](https://cloud.ouraring.com/docs/) to set up a new application.
2. Register the Redirect URI as `http://localhost:8080/callback`.
3. Select your required scopes (e.g. `sleep`, `daily`, `stress`, `personal`).
4. Copy your **Client ID** and **Client Secret**.

---

## Step 2: Configure Environment Variables

Create a `.env` file in the root of the project directory (refer to [.env.example](.env.example)):
```env
OURA_CLIENT_ID=your_oura_client_id_here
OURA_CLIENT_SECRET=your_oura_client_secret_here
RECIPIENT_PHONE=recipient_phone_number_here
```
*Note: The phone number must contain only digits, including country code (e.g., American: `15551234567`). No "+" or spaces.*

---

## Step 3: Run Initial Oura Authorization (Once)

Because Oura uses OAuth2 with rotating tokens, you must authorize it once via your browser to generate the initial token credentials:

1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the local authorization helper:
   ```bash
   node auth_setup.js
   ```
3. Open the link displayed in your terminal in your web browser.
4. Log into Oura, authorize the app, and wait for the "Success" message.
5. This generates a `state.json` file containing your access and refresh tokens.

---

## Step 4: Link WhatsApp & Run Commands

You can run the script with different flags depending on your environment:

### 1. Test WhatsApp Connection
Send a static test message to verify the connection and link your WhatsApp session (scans QR code on first run):
```bash
node index.js --test-send
```

### 2. Dry Run
Fetch current metrics and preview the generated report directly in your console (does not send anything to WhatsApp):
```bash
node index.js --dry-run
```

### 3. Production Run (Standard)
Fetch metrics, compile the report, and send it to your recipient's WhatsApp. It automatically records the date in `state.json` to prevent sending duplicate reports for the same day if run multiple times:
```bash
node index.js
```

### 4. Force Send
Fetch metrics, compile the report, and send it immediately (ignores duplicate check restrictions):
```bash
node index.js --force
```

---

## Customizing the Message

To customize the message content, translate the labels, or edit emojis, modify the `constructMessage` function in `index.js`:

```javascript
function constructMessage(metrics) {
  // ... format values ...
  return (
    `- Sleep time: ${duration}\n` +
    `- Sleep Score: ${sleepSc}\n` +
    // Customize your labels, symbols, or layout here!
  );
}
```

You can also customize the stress status translations in `translateStress(stress)`.
