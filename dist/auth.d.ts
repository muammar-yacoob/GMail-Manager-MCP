import { OAuth2Client } from 'google-auth-library';
export declare function setupAuth(): Promise<OAuth2Client>;
export declare function loadCredentials(): OAuth2Client | null;
export declare function getAuthenticatedClient(): Promise<OAuth2Client>;
export declare function debugAuth(): Promise<void>;
export declare function getCredentials(): Promise<OAuth2Client | null>;
export declare function checkAuthStatus(): Promise<{
    hasOAuthKeys: boolean;
    hasCredentials: boolean;
    credentialsValid: boolean;
}>;
export declare function getOAuthClient(): Promise<OAuth2Client | null>;
export declare function hasValidCredentials(oauth2Client: OAuth2Client): Promise<boolean>;
export declare function authenticateWeb(oauth2Client: OAuth2Client, credentialsPath?: string): Promise<void>;
