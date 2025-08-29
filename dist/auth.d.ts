import { OAuth2Client } from 'google-auth-library';
export declare function getCredentials(): Promise<OAuth2Client>;
export declare function checkAuthStatus(): Promise<{
    hasOAuthKeys: boolean;
    hasCredentials: boolean;
    credentialsValid: boolean;
}>;
export declare function authenticate(oauth2Client: OAuth2Client, credentialsPath?: string): Promise<void>;
