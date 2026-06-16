import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Storage } from './storage';

const JWT_SECRET = process.env.JWT_SECRET || 'salema-dev-secret-troca-em-producao';
const TOKEN_TTL = '30d';
const BCRYPT_ROUNDS = 10;

if (!process.env.JWT_SECRET) {
  console.warn('⚠️  JWT_SECRET não definido — a usar um segredo de desenvolvimento. Define-o em produção.');
}

/** Erro com mensagem já pronta para mostrar ao utilizador (pt-PT). */
export class AuthError extends Error {}

export interface AuthUser {
  id: number;
  username: string;
}
export interface AuthResult {
  token: string;
  user: AuthUser;
}
export interface TokenPayload {
  userId: number;
  username: string;
}

const USERNAME_RE = /^[A-Za-z0-9_.\- ]{3,16}$/;

export function validateUsername(username: unknown): string {
  const t = typeof username === 'string' ? username.trim() : '';
  if (!USERNAME_RE.test(t)) {
    throw new AuthError('O nome deve ter 3 a 16 caracteres (letras, números, espaço, _ . -).');
  }
  return t;
}

export function validatePassword(password: unknown): string {
  if (typeof password !== 'string' || password.length < 6) {
    throw new AuthError('A palavra-passe deve ter pelo menos 6 caracteres.');
  }
  if (password.length > 100) {
    throw new AuthError('Palavra-passe demasiado longa.');
  }
  return password;
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(user: AuthUser): string {
  return jwt.sign({ username: user.username }, JWT_SECRET, {
    subject: String(user.id),
    expiresIn: TOKEN_TTL,
  });
}

export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { sub?: string; username?: string };
    if (!decoded.sub || !decoded.username) return null;
    return { userId: Number(decoded.sub), username: decoded.username };
  } catch {
    return null;
  }
}

export async function registerUser(
  storage: Storage,
  username: unknown,
  password: unknown,
): Promise<AuthResult> {
  const name = validateUsername(username);
  const pw = validatePassword(password);
  const hash = await hashPassword(pw);
  let user;
  try {
    user = await storage.createUser(name, hash);
  } catch (e) {
    if (e instanceof Error && e.message === 'USERNAME_TAKEN') {
      throw new AuthError('Esse nome já está a ser usado.');
    }
    throw e;
  }
  const authUser = { id: user.id, username: user.username };
  return { token: signToken(authUser), user: authUser };
}

export async function loginUser(
  storage: Storage,
  username: unknown,
  password: unknown,
): Promise<AuthResult> {
  const name = typeof username === 'string' ? username.trim() : '';
  const pw = typeof password === 'string' ? password : '';
  const generic = new AuthError('Nome ou palavra-passe incorretos.');
  if (!name || !pw) throw generic;
  const user = await storage.findByUsername(name);
  if (!user) throw generic;
  const ok = await verifyPassword(pw, user.passwordHash);
  if (!ok) throw generic;
  const authUser = { id: user.id, username: user.username };
  return { token: signToken(authUser), user: authUser };
}
