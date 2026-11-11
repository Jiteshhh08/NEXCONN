import "server-only";

import QRCode from "qrcode";

import { serverEnv } from "@/lib/env";

export function buildJoinUrl(joinCode: string): string {
  const base = serverEnv.APP_BASE_URL.replace(/\/+$/, "");
  return `${base}/join/${joinCode}`;
}

/**
 * Generates a scannable data URL on the server so the browser never needs a QR
 * library and the code always points at APP_BASE_URL.
 */
export async function buildRoomShare(joinCode: string): Promise<{
  joinUrl: string;
  qrDataUrl: string;
}> {
  const joinUrl = buildJoinUrl(joinCode);
  const qrDataUrl = await QRCode.toDataURL(joinUrl, {
    width: 640,
    margin: 1,
    errorCorrectionLevel: "M",
    color: { dark: "#0f5c53", light: "#fffdf8" },
  });

  return { joinUrl, qrDataUrl };
}
