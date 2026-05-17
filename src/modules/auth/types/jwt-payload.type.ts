export interface JwtPayload {
  sub: string;   // userId
  role: string;  // RoleName value
  jti: string;   // unique token ID for blacklisting
  iat: number;
  exp: number;
}

export interface OAuthStatePayload {
  nonce: string;
  invitationToken?: string;
}
