export interface ServiceAccountKey {
  id: string;
  publicKey: string;
  createdAt?: string;
  credentials: {
    iss: string;
    kid: string;
    privateKey?: string;
  };
}

export interface StoredToken {
  access_token: string;
  expires_at: number;
  refresh_token?: string;
  idp_token_endpoint?: string;
}

export interface CliCredentials {
  STACKIT_SERVICE_ACCOUNT_KEY_PATH?: string;
  STACKIT_PRIVATE_KEY_PATH?: string;
}
