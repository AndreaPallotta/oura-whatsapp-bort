const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });

const config = {
  OURA_CLIENT_ID: process.env.OURA_CLIENT_ID,
  OURA_CLIENT_SECRET: process.env.OURA_CLIENT_SECRET,
  RECIPIENT_PHONE: process.env.RECIPIENT_PHONE,
  STATE_FILE: path.join(__dirname, 'state.json'),
  
  validateConfig(isAuthSetup = false) {
    const missing = [];
    if (!this.OURA_CLIENT_ID) missing.push('OURA_CLIENT_ID');
    if (!this.OURA_CLIENT_SECRET) missing.push('OURA_CLIENT_SECRET');
    if (!isAuthSetup) {
      if (!this.RECIPIENT_PHONE) missing.push('RECIPIENT_PHONE');
    }
    
    if (missing.length > 0) {
      console.error(`Error: Missing required configuration variables in .env: ${missing.join(', ')}`);
      console.error("Please check your .env file in the project folder.");
      process.exit(1);
    }
  }
};

module.exports = config;
