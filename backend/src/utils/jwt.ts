// JWT token generation and verification
import jwt from 'jsonwebtoken';
import config from '../config/env';

export interface JWTPayload {
  sub: number; // user ID
  iat: number;
  exp: number;
}

export const generateAccessToken = (userId: number): string => {
  return jwt.sign(
    { sub: userId },
    config.JWT_ACCESS_SECRET,
    { expiresIn: config.JWT_ACCESS_EXPIRES } as jwt.SignOptions
  );
};

export const generateRefreshToken = (userId: number): string => {
  return jwt.sign(
    { sub: userId },
    config.JWT_REFRESH_SECRET,
    { expiresIn: config.JWT_REFRESH_EXPIRES } as jwt.SignOptions
  );
};

export const verifyAccessToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.JWT_ACCESS_SECRET) as unknown as JWTPayload;
};

export const verifyRefreshToken = (token: string): JWTPayload => {
  return jwt.verify(token, config.JWT_REFRESH_SECRET) as unknown as JWTPayload;
};

export const decodeToken = (token: string): JWTPayload | null => {
  try {
    return jwt.decode(token) as unknown as JWTPayload;
  } catch {
    return null;
  }
};
