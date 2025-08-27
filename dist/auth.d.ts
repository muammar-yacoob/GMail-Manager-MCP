import { OAuth2Client } from 'google-auth-library';
export declare function getCredentials(): Promise<OAuth2Client>;
export declare function authenticate(oauth2Client: OAuth2Client, credentialsPath?: string): Promise<void>;
