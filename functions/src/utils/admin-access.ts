import * as admin from "firebase-admin";
import { HttpsError } from "firebase-functions/v2/https";

const db = admin.firestore();
const ADMIN_CACHE_TTL_MS = 60 * 1000;

const adminAccessCache = new Map<string, { isAdmin: boolean; fetchedAt: number; exists: boolean }>();

export async function verifyAdminAccess(
  userId: string,
  deniedMessage: string
): Promise<void> {
  const cached = adminAccessCache.get(userId);
  if (cached && Date.now() - cached.fetchedAt < ADMIN_CACHE_TTL_MS) {
    if (!cached.exists) {
      throw new HttpsError("not-found", "Usuario no encontrado");
    }
    if (!cached.isAdmin) {
      throw new HttpsError("permission-denied", deniedMessage);
    }
    return;
  }

  const userDoc = await db.collection("users").doc(userId).get();
  if (!userDoc.exists) {
    adminAccessCache.set(userId, { isAdmin: false, exists: false, fetchedAt: Date.now() });
    throw new HttpsError("not-found", "Usuario no encontrado");
  }

  const userData = userDoc.data();
  const isAdmin = userData?.role === "admin" || userData?.role === "superadmin";
  adminAccessCache.set(userId, { isAdmin, exists: true, fetchedAt: Date.now() });

  if (!isAdmin) {
    throw new HttpsError("permission-denied", deniedMessage);
  }
}
