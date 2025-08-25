// src/api/users.ts
import { api } from "../config/api";

// Superadmin: update a user's MFA policy
export async function updateUserMfa(
  id: string,
  payload: { required: boolean; method: "otp" | "totp" | null }
) {
  const { data } = await api.patch(`/users/${id}/mfa`, payload);
  return data;
}
