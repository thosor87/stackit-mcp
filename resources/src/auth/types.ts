export interface ServiceAccountKey {
  id: string;
  publicKey: string;
  createdAt?: string;
  credentials: {
    iss: string;    // service account email
    kid: string;
    privateKey?: string;  // inline PEM
  };
}

export interface StoredToken {
  access_token: string;
  expires_at: number;  // unix timestamp ms
}

export interface CliCredentials {
  STACKIT_SERVICE_ACCOUNT_KEY_PATH?: string;
  STACKIT_PRIVATE_KEY_PATH?: string;
  STACKIT_SERVICE_ACCOUNT_TOKEN?: string;
}
