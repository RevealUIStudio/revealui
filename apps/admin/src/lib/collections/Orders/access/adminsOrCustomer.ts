import { z } from 'zod';
import { Role } from '@/lib/access/permissions/roles';
import { hasRole } from '@/lib/access/roles/hasRole';

const orderReadUserSchema = z
  .object({
    id: z.string().min(1),
    globalRoles: z.array(z.string()).optional(),
    roles: z.array(z.string()).optional(),
  })
  .passthrough();
const orderCreateDataSchema = z.object({ customerId: z.string().min(1) }).passthrough();

function readUser(req: { user?: unknown }) {
  // Auth adapters supply the principal at runtime; only schema parsing proves
  // it has the fields needed for owner scoping.
  return orderReadUserSchema.safeParse(req.user);
}

export const adminsOrCustomer = ({ req }: { req: { user?: unknown } }) => {
  const parsedUser = readUser(req);
  if (!parsedUser.success) return false;
  if (hasRole(parsedUser.data, [Role.TenantSuperAdmin])) return true;
  return { customerId: { equals: parsedUser.data.id } };
};

export const adminsOrOwnOrderCreate = ({
  req,
  data,
}: {
  req: { user?: unknown };
  data?: unknown;
}) => {
  const parsedUser = readUser(req);
  if (!parsedUser.success) return false;
  if (hasRole(parsedUser.data, [Role.TenantSuperAdmin])) return true;
  const parsedData = orderCreateDataSchema.safeParse(data);
  return parsedData.success && parsedData.data.customerId === parsedUser.data.id;
};
