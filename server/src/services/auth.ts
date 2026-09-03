import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { prisma } from "../db.js";

const DEMO_USERNAME = "sales";
const DEMO_PASSWORD = "leeec2026";
const DEFAULT_NAME = "业务员";
const DEFAULT_TITLE = "外贸业务员";
const DEFAULT_AVATAR = "业";

export type PublicUser = {
  id: string;
  username: string;
  displayName: string;
  title: string;
  avatarText: string;
  avatarUrl: string | null;
};

function hashPassword(password: string, salt: string) {
  return createHash("sha256").update(`${salt}:${password}`).digest("hex");
}

function verifyPassword(password: string, salt: string, passwordHash: string) {
  const next = hashPassword(password, salt);
  const left = Buffer.from(next, "hex");
  const right = Buffer.from(passwordHash, "hex");
  return left.length === right.length && timingSafeEqual(left, right);
}

function serializeUser(row: {
  id: string;
  username: string;
  displayName: string;
  title: string;
  avatarText: string;
  avatarUrl?: string | null;
}): PublicUser {
  return {
    id: row.id,
    username: row.username,
    displayName: row.displayName,
    title: row.title,
    avatarText: row.avatarText,
    avatarUrl: row.avatarUrl ?? null,
  };
}

export async function ensureDefaultUser() {
  const existing = await prisma.workbenchUser.findUnique({ where: { username: DEMO_USERNAME } });
  if (existing) {
    if (existing.displayName === "程咨翰") {
      const row = await prisma.workbenchUser.update({
        where: { username: DEMO_USERNAME },
        data: { displayName: DEFAULT_NAME, avatarText: DEFAULT_AVATAR },
      });
      return serializeUser(row);
    }
    return serializeUser(existing);
  }
  const salt = randomBytes(16).toString("hex");
  const row = await prisma.workbenchUser.create({
    data: {
      username: DEMO_USERNAME,
      passwordSalt: salt,
      passwordHash: hashPassword(DEMO_PASSWORD, salt),
      displayName: DEFAULT_NAME,
      title: DEFAULT_TITLE,
      avatarText: DEFAULT_AVATAR,
    },
  });
  return serializeUser(row);
}

export async function loginWorkbench(username: string, password: string) {
  const name = username.trim().toLowerCase();
  if (!name || !password) throw new Error("CREDENTIALS_REQUIRED");
  await ensureDefaultUser();
  const row = await prisma.workbenchUser.findUnique({ where: { username: name } });
  if (!row || !verifyPassword(password, row.passwordSalt, row.passwordHash)) {
    throw new Error("INVALID_CREDENTIALS");
  }
  return serializeUser(row);
}

export async function getWorkbenchUser(username: string) {
  const name = username.trim().toLowerCase();
  if (!name) throw new Error("UNAUTHORIZED");
  const row = await prisma.workbenchUser.findUnique({ where: { username: name } });
  if (!row) throw new Error("UNAUTHORIZED");
  return serializeUser(row);
}

function firstAvatarChar(name: string) {
  const compact = name.trim();
  return compact ? compact.slice(0, 1) : DEFAULT_AVATAR;
}

export async function updateWorkbenchProfile(
  username: string,
  body: {
    displayName?: string;
    title?: string;
    avatarUrl?: string | null;
    clearAvatar?: boolean;
    currentPassword?: string;
    newPassword?: string;
  },
) {
  const name = username.trim().toLowerCase();
  const row = await prisma.workbenchUser.findUnique({ where: { username: name } });
  if (!row) throw new Error("UNAUTHORIZED");

  const displayName = body.displayName !== undefined ? body.displayName.trim() : row.displayName;
  if (!displayName) throw new Error("NAME_REQUIRED");
  if (displayName.length > 20) throw new Error("NAME_TOO_LONG");

  const title = body.title !== undefined ? body.title.trim() : row.title;
  if (title.length > 30) throw new Error("TITLE_TOO_LONG");

  let avatarUrl = row.avatarUrl;
  if (body.clearAvatar) avatarUrl = null;
  else if (body.avatarUrl !== undefined) {
    if (body.avatarUrl && !body.avatarUrl.startsWith("data:image/")) throw new Error("AVATAR_INVALID");
    if (body.avatarUrl && body.avatarUrl.length > 350_000) throw new Error("AVATAR_TOO_LARGE");
    avatarUrl = body.avatarUrl;
  }

  let passwordSalt = row.passwordSalt;
  let passwordHash = row.passwordHash;
  if (body.newPassword) {
    if (!body.currentPassword) throw new Error("CURRENT_PASSWORD_REQUIRED");
    if (!verifyPassword(body.currentPassword, row.passwordSalt, row.passwordHash)) {
      throw new Error("INVALID_CURRENT_PASSWORD");
    }
    if (body.newPassword.length < 6) throw new Error("PASSWORD_TOO_SHORT");
    passwordSalt = randomBytes(16).toString("hex");
    passwordHash = hashPassword(body.newPassword, passwordSalt);
  }

  const updated = await prisma.workbenchUser.update({
    where: { id: row.id },
    data: {
      displayName,
      title: title || DEFAULT_TITLE,
      avatarText: firstAvatarChar(displayName),
      avatarUrl,
      passwordSalt,
      passwordHash,
    },
  });
  return serializeUser(updated);
}
