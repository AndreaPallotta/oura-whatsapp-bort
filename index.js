const fs = require('fs');
const path = require('path');
const axios = require('axios');
const querystring = require('querystring');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const qrcode = require('qrcode-terminal');
const pino = require('pino');

const config = require('./config');

// Parse command line arguments
const args = {
  dryRun: process.argv.includes('--dry-run'),
  testSend: process.argv.includes('--test-send'),
  force: process.argv.includes('--force')
};

// State loader
function loadState() {
  if (!fs.existsSync(config.STATE_FILE)) {
    console.error(`Error: State file not found at ${config.STATE_FILE}`);
    console.error("Please run auth_setup.js on your computer first to authorize your Oura account.");
    process.exit(1);
  }
  return JSON.parse(fs.readFileSync(config.STATE_FILE, 'utf8'));
}

// State saver
function saveState(state) {
  fs.writeFileSync(config.STATE_FILE, JSON.stringify(state, null, 4), 'utf8');
}

// Oura Token Refresh
async function refreshOuraTokens(state) {
  console.log("Refreshing Oura access token...");
  const tokenUrl = "https://api.ouraring.com/oauth/token";
  const payload = querystring.stringify({
    grant_type: "refresh_token",
    refresh_token: state.refresh_token,
    client_id: config.OURA_CLIENT_ID,
    client_secret: config.OURA_CLIENT_SECRET
  });

  try {
    const response = await axios.post(tokenUrl, payload, {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });
    
    state.access_token = response.data.access_token;
    state.refresh_token = response.data.refresh_token;
    saveState(state);
    console.log("Tokens refreshed successfully.");
    return state;
  } catch (error) {
    console.error("Error refreshing Oura access token:");
    if (error.response) {
      console.error(error.response.data);
    } else {
      console.error(error.message);
    }
    throw error;
  }
}

// Oura API Helper
async function apiGet(endpoint, accessToken, params = {}, state) {
  const url = `https://api.ouraring.com/v2/usercollection/${endpoint}`;
  try {
    const response = await axios.get(url, {
      headers: { 'Authorization': `Bearer ${accessToken}` },
      params
    });
    return response.data.data || [];
  } catch (error) {
    if (error.response && error.response.status === 401) {
      console.log("Oura request unauthorized (expired token). Attempting refresh...");
      const updatedState = await refreshOuraTokens(state);
      // Retry request once with the new token
      const retryResponse = await axios.get(url, {
        headers: { 'Authorization': `Bearer ${updatedState.access_token}` },
        params
      });
      return retryResponse.data.data || [];
    }
    console.error(`Error calling Oura API endpoint /${endpoint}: ${error.message}`);
    return [];
  }
}

// Fetch Oura metrics for the last 2 days
async function fetchLatestMetrics(state) {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const formatDateString = (date) => date.toISOString().split('T')[0];
  const startStr = formatDateString(yesterday);
  const endStr = formatDateString(today);

  console.log(`Querying Oura metrics between ${startStr} and ${endStr}...`);
  const params = { start_date: startStr, end_date: endStr };

  const [sleep, dailySleep, dailyReadiness, dailyStress] = await Promise.all([
    apiGet('sleep', state.access_token, params, state),
    apiGet('daily_sleep', state.access_token, params, state),
    apiGet('daily_readiness', state.access_token, params, state),
    apiGet('daily_stress', state.access_token, params, state)
  ]);

  // Find latest long_sleep
  let latestSleep = sleep.slice().reverse().find(s => s.type === 'long_sleep');
  if (!latestSleep && sleep.length > 0) {
    latestSleep = sleep[sleep.length - 1];
  }

  if (!latestSleep) {
    console.log("No sleep records found for this range.");
    return null;
  }

  const sleepDay = latestSleep.day;

  // Match scores by date
  const sleepScore = dailySleep.slice().reverse().find(ds => ds.day === sleepDay)?.score 
                     || (dailySleep.length > 0 ? dailySleep[dailySleep.length - 1].score : null);

  const matchedReadiness = dailyReadiness.slice().reverse().find(dr => dr.day === sleepDay)
                           || (dailyReadiness.length > 0 ? dailyReadiness[dailyReadiness.length - 1] : null);
  const readinessScore = matchedReadiness ? matchedReadiness.score : null;
  const tempDeviation = matchedReadiness ? matchedReadiness.temperature_deviation : null;

  const stressSummary = dailyStress.slice().reverse().find(dst => dst.day === sleepDay)?.day_summary 
                        || (dailyStress.length > 0 ? dailyStress[dailyStress.length - 1].day_summary : null);

  return {
    day: sleepDay,
    sleep_duration: latestSleep.total_sleep_duration, // in seconds
    sleep_score: sleepScore,
    readiness_score: readinessScore,
    stress_summary: stressSummary,
    average_heart_rate: latestSleep.average_heart_rate,
    lowest_heart_rate: latestSleep.lowest_heart_rate,
    average_hrv: latestSleep.average_hrv,
    average_breath: latestSleep.average_breath,
    temperature_deviation: tempDeviation
  };
}

// Translation mapping for multi-language support
const translations = {
  en: {
    sleepTime: "Sleep time",
    sleepScore: "Sleep Score",
    readiness: "Readiness",
    daytimeStress: "Daytime Stress",
    averageHeartRate: "Average Heart Rate",
    lowest: "lowest",
    averageHrv: "Average HRV",
    respiratoryRate: "Respiratory Rate",
    breathsPerMin: "breaths/min",
    tempDeviation: "Temperature Deviation",
    notAvailable: "Not available",
    stressRestored: "Mostly relaxed",
    stressNormal: "Normal",
    stressful: "Slightly stressed",
    stressHigh: "Highly stressed"
  },
  it: {
    sleepTime: "Ho dormito",
    sleepScore: "Punteggio Sonno",
    readiness: "Prontezza (Readiness)",
    daytimeStress: "Stress diurno",
    averageHeartRate: "Battito cardiaco medio",
    lowest: "minimo",
    averageHrv: "HRV medio",
    respiratoryRate: "Frequenza respiratoria",
    breathsPerMin: "respiri/min",
    tempDeviation: "Variazione temperatura",
    notAvailable: "Non disponibile",
    stressRestored: "Principalmente rilassato",
    stressNormal: "Tranquillo (nella norma)",
    stressful: "Un po' stressato/impegnativo",
    stressHigh: "Stress elevato"
  }
};

// Formatter and Translator
function formatSleepDuration(seconds) {
  const lang = (config.LANGUAGE || 'en').toLowerCase();
  const t = translations[lang] || translations.en;
  if (!seconds) return t.notAvailable;
  
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const connector = lang === 'it' ? 'e ' : '';
  return `*${hours}h ${connector}${minutes}m*`;
}

function translateStress(stress) {
  const lang = (config.LANGUAGE || 'en').toLowerCase();
  const t = translations[lang] || translations.en;
  
  const stressMap = {
    restored: t.stressRestored,
    normal: t.stressNormal,
    stressful: t.stressful,
    stress: t.stressHigh
  };
  if (!stress) return t.stressNormal;
  return stressMap[stress.toLowerCase()] || stress;
}

function constructMessage(metrics) {
  const lang = (config.LANGUAGE || 'en').toLowerCase();
  const t = translations[lang] || translations.en;

  const duration = formatSleepDuration(metrics.sleep_duration);
  const sleepSc = metrics.sleep_score ? `*${metrics.sleep_score}/100*` : t.notAvailable;
  const readinessSc = metrics.readiness_score ? `*${metrics.readiness_score}/100*` : t.notAvailable;
  const stress = translateStress(metrics.stress_summary);
  const avgHr = metrics.average_heart_rate ? `*${Math.round(metrics.average_heart_rate)} bpm*` : t.notAvailable;
  const minHr = metrics.lowest_heart_rate ? `*${Math.round(metrics.lowest_heart_rate)} bpm*` : t.notAvailable;

  const hrv = metrics.average_hrv ? `*${Math.round(metrics.average_hrv)} ms*` : t.notAvailable;
  const breath = metrics.average_breath ? `*${metrics.average_breath.toFixed(1)} ${t.breathsPerMin}*` : t.notAvailable;
  
  let tempStr = t.notAvailable;
  if (metrics.temperature_deviation !== undefined && metrics.temperature_deviation !== null) {
    const sign = metrics.temperature_deviation > 0 ? "+" : "";
    tempStr = `*${sign}${metrics.temperature_deviation.toFixed(2)} °C*`;
  }

  return (
    `- ${t.sleepTime}: ${duration}\n` +
    `- ${t.sleepScore}: ${sleepSc}\n` +
    `- ${t.readiness}: ${readinessSc}\n` +
    `- ${t.daytimeStress}: ${stress}\n` +
    `- ${t.averageHeartRate}: ${avgHr} (${t.lowest}: ${minHr})\n` +
    `- ${t.averageHrv}: ${hrv}\n` +
    `- ${t.respiratoryRate}: ${breath}\n` +
    `- ${t.tempDeviation}: ${tempStr}`
  );
}

// WhatsApp Connection and Execution
async function connectToWhatsAppAndSend(messageToSend, sleepDayToRecord, state) {
  console.log("Initializing WhatsApp connection...");
  const { version, isLatest } = await fetchLatestBaileysVersion();
  console.log(`Using WA v${version.join('.')}, isLatest: ${isLatest}`);
  
  const authDir = path.join(__dirname, 'auth');
  const { state: authState, saveCreds } = await useMultiFileAuthState(authDir);

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    auth: authState,
    printQRInTerminal: false // Custom formatting with qrcode-terminal
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("\nScan this QR code using Link Device in your WhatsApp app:");
      qrcode.generate(qr, { small: true });

      // Save QR code to a PNG file for easy scanning
      const qrcodeImage = require('qrcode');
      const qrPath = path.join(__dirname, 'qr.png');
        
      qrcodeImage.toFile(qrPath, qr, (err) => {
        if (err) console.error("Failed to save QR PNG:", err);
        else console.log(`QR code PNG saved to: ${qrPath}`);
      });
    }

    if (connection === 'close') {
      const statusCode = lastDisconnect.error?.output?.statusCode;
      const shouldReconnect = lastDisconnect.error && statusCode !== DisconnectReason.loggedOut;
      console.log(`Connection closed. Status: ${statusCode}. Error:`, lastDisconnect.error);
      console.log(`Reconnecting: ${!!shouldReconnect}`);
      if (shouldReconnect) {
        connectToWhatsAppAndSend(messageToSend, sleepDayToRecord, state);
      } else {
        console.error("WhatsApp session logged out. You must re-scan the QR code.");
        process.exit(1);
      }
    } else if (connection === 'open') {
      console.log("Connected to WhatsApp successfully!");
      
      const cleanPhone = config.RECIPIENT_PHONE.replace(/\D/g, '');
      const recipientJid = `${cleanPhone}@s.whatsapp.net`;
      
      console.log(`Sending report to ${recipientJid}...`);
      try {
        await sock.sendMessage(recipientJid, { text: messageToSend });
        console.log("Message sent successfully!");
        
        // Record status
        if (sleepDayToRecord) {
          state.last_sent_date = sleepDayToRecord;
          saveState(state);
          console.log(`Recorded successful send for date: ${sleepDayToRecord}`);
        }
        
        // Wait a moment and exit (5 seconds ensures pre-key exchange finishes)
        setTimeout(() => {
          console.log("Closing connection...");
          process.exit(0);
        }, 5000);
        
      } catch (err) {
        console.error(`Failed to send WhatsApp message: ${err.message}`);
        process.exit(1);
      }
    }
  });
}

// Orchestrator
async function main() {
  config.validateConfig(false);
  const state = loadState();

  // Test send mode
  if (args.testSend) {
    const testMsg = "This is a test message from oura-whatsapp-bot";
    if (args.dryRun) {
      console.log("\n--- DRY RUN: Test message (Not Sent) ---");
      console.log(testMsg);
      console.log("----------------------------------------\n");
      process.exit(0);
    }
    await connectToWhatsAppAndSend(testMsg, null, state);
    return;
  }

  // Fetch metrics
  const metrics = await fetchLatestMetrics(state);
  if (!metrics) {
    console.log("Oura Ring sleep data for today is not available yet.");
    console.log("Please open your Oura App on your phone to sync your ring to the cloud.");
    process.exit(0);
  }

  const sleepDay = metrics.day;
  console.log(`Latest Oura metrics belong to day: ${sleepDay}`);

  // Check if sent
  if (sleepDay === state.last_sent_date && !args.force && !args.dryRun) {
    console.log(`Report for ${sleepDay} has already been sent today.`);
    console.log("Skipping to prevent duplicate messages.");
    process.exit(0);
  }

  const message = constructMessage(metrics);

  if (args.dryRun) {
    console.log("\n--- DRY RUN: Message (Not Sent) ---");
    console.log(message);
    console.log("-----------------------------------\n");
    process.exit(0);
  }

  // Send message via WhatsApp
  await connectToWhatsAppAndSend(message, sleepDay, state);
}

main().catch(err => {
  console.error("Fatal error:", err);
  process.exit(1);
});
