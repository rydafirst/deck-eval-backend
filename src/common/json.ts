import type { Prisma } from '../generated/prisma/client';

export function toJson(value: unknown): Prisma.InputJsonValue {
  return value as Prisma.InputJsonValue;
}
