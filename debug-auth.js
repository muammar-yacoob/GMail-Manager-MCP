import { getCredentials } from "./dist/auth.js";
import fs from "fs";

async function debug() {
    console.log("GMAIL_OAUTH_PATH:", process.env.GMAIL_OAUTH_PATH);
    console.log("File exists:", fs.existsSync(process.env.GMAIL_OAUTH_PATH || ""));
    
    try {
        const client = await getCredentials();
        console.log("OAuth client created:", !!client);
        console.log("Has credentials:", !!client.credentials?.access_token);
    } catch (error) {
        console.log("Error:", error.message);
    }
}

debug();
