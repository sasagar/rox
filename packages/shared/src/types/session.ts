import type { ID, Timestamps } from "./common.js";

export interface Session extends Timestamps {
  id: ID;
  userId: ID;
  token: string;
  expiresAt: Date;
  userAgent: string | null;
  ipAddress: string | null;
}
