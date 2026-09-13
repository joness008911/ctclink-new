import { storage } from "./storage";
import { maskEmail } from "./authVerificationService";

interface FailedAttemptRecord {
  count: number;
  firstAttemptAt: number;
  lastAttemptAt: number;
  lockedUntil: number | null;
}

// In-memory tracking maps
// 1. Per-account (username or email in lowercase)
const accountAttempts = new Map<string, FailedAttemptRecord>();
// 2. Per-IP address
const ipAttempts = new Map<string, FailedAttemptRecord>();

// Security Policy
export const MAX_FAILED_ATTEMPTS = 5; // 5 failed attempts allowed
export const ATTEMPT_WINDOW_MS = 15 * 60 * 1000; // 15-minute sliding window
export const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15-minute lockout

// Clean up stale entries every 10 minutes to prevent memory leaks
const cleanupTimer = setInterval(() => {
  const now = Date.now();
  for (const [key, record] of accountAttempts.entries()) {
    if (record.lockedUntil && record.lockedUntil > now) continue;
    if (now - record.lastAttemptAt > ATTEMPT_WINDOW_MS) {
      accountAttempts.delete(key);
    }
  }
  for (const [key, record] of ipAttempts.entries()) {
    if (record.lockedUntil && record.lockedUntil > now) continue;
    if (now - record.lastAttemptAt > ATTEMPT_WINDOW_MS) {
      ipAttempts.delete(key);
    }
  }
}, 10 * 60 * 1000);
if (cleanupTimer && typeof cleanupTimer.unref === 'function') {
  cleanupTimer.unref();
}

export function isAccountLocked(identifier: string): { isLocked: boolean; remainingSeconds: number } {
  const cleanId = identifier.toLowerCase().trim();
  const record = accountAttempts.get(cleanId);
  if (!record || !record.lockedUntil) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  if (now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  // Lockout expired
  record.lockedUntil = null;
  record.count = 0;
  return { isLocked: false, remainingSeconds: 0 };
}

export function isIpLocked(ip: string): { isLocked: boolean; remainingSeconds: number } {
  const cleanIp = ip.trim();
  const record = ipAttempts.get(cleanIp);
  if (!record || !record.lockedUntil) {
    return { isLocked: false, remainingSeconds: 0 };
  }

  const now = Date.now();
  if (now < record.lockedUntil) {
    const remainingSeconds = Math.ceil((record.lockedUntil - now) / 1000);
    return { isLocked: true, remainingSeconds };
  }

  record.lockedUntil = null;
  record.count = 0;
  return { isLocked: false, remainingSeconds: 0 };
}

export function recordFailedLogin(identifier: string, ip: string): {
  isLocked: boolean;
  remainingAttempts: number;
  remainingSeconds: number;
} {
  const now = Date.now();
  const cleanId = identifier.toLowerCase().trim();
  const cleanIp = ip.trim();

  // 1. Update Account Record
  let accRecord = accountAttempts.get(cleanId);
  if (!accRecord || now - accRecord.lastAttemptAt > ATTEMPT_WINDOW_MS) {
    accRecord = { count: 1, firstAttemptAt: now, lastAttemptAt: now, lockedUntil: null };
  } else {
    accRecord.count += 1;
    accRecord.lastAttemptAt = now;
  }

  let accountLocked = false;
  let remainingSeconds = 0;

  if (accRecord.count >= MAX_FAILED_ATTEMPTS) {
    accRecord.lockedUntil = now + LOCKOUT_DURATION_MS;
    accountLocked = true;
    remainingSeconds = Math.ceil(LOCKOUT_DURATION_MS / 1000);

    console.warn(
      `[SECURITY_EVENT] Account locked out due to ${accRecord.count} failed attempts: ${maskEmail(
        cleanId
      )} from IP ${cleanIp}`
    );

    storage.createAuditLog({
      actorId: cleanId,
      actorType: "system",
      action: "auth.account_locked",
      ipAddress: cleanIp,
      metadata: {
        identifier: maskEmail(cleanId),
        failedAttempts: accRecord.count,
        lockoutDurationSeconds: remainingSeconds,
      },
    }).catch(err => console.error("Audit log error on account lock:", err));
  }
  accountAttempts.set(cleanId, accRecord);

  // 2. Update IP Record
  let ipRecord = ipAttempts.get(cleanIp);
  if (!ipRecord || now - ipRecord.lastAttemptAt > ATTEMPT_WINDOW_MS) {
    ipRecord = { count: 1, firstAttemptAt: now, lastAttemptAt: now, lockedUntil: null };
  } else {
    ipRecord.count += 1;
    ipRecord.lastAttemptAt = now;
  }
  if (ipRecord.count >= MAX_FAILED_ATTEMPTS * 2) {
    // Stricter threshold for IP lockout (e.g. 10 failed attempts across accounts from one IP)
    ipRecord.lockedUntil = now + LOCKOUT_DURATION_MS;
  }
  ipAttempts.set(cleanIp, ipRecord);

  const remainingAttempts = Math.max(0, MAX_FAILED_ATTEMPTS - accRecord.count);

  storage.createAuditLog({
    actorId: cleanId,
    actorType: "system",
    action: "auth.login_failed",
    ipAddress: cleanIp,
    metadata: {
      identifier: maskEmail(cleanId),
      failedAttempts: accRecord.count,
      remainingAttempts,
    },
  }).catch(err => console.error("Audit log error on failed login:", err));

  return {
    isLocked: accountLocked,
    remainingAttempts,
    remainingSeconds,
  };
}

export function recordSuccessfulLogin(identifier: string, ip: string): void {
  const cleanId = identifier.toLowerCase().trim();
  const cleanIp = ip.trim();

  accountAttempts.delete(cleanId);

  // Decrement or clear IP count on successful login
  const ipRec = ipAttempts.get(cleanIp);
  if (ipRec) {
    ipRec.count = Math.max(0, ipRec.count - 1);
    if (ipRec.count === 0) ipAttempts.delete(cleanIp);
    else ipAttempts.set(cleanIp, ipRec);
  }
}

export function getLockoutStatus(identifier: string): { attempts: number; isLocked: boolean; remainingSeconds: number } {
  const cleanId = identifier.toLowerCase().trim();
  const record = accountAttempts.get(cleanId);
  if (!record) {
    return { attempts: 0, isLocked: false, remainingSeconds: 0 };
  }
  const now = Date.now();
  const isLocked = !!(record.lockedUntil && record.lockedUntil > now);
  const remainingSeconds = isLocked ? Math.ceil((record.lockedUntil! - now) / 1000) : 0;
  return {
    attempts: record.count,
    isLocked,
    remainingSeconds,
  };
}

