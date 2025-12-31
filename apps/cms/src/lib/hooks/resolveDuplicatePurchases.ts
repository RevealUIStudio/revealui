/* eslint-disable prettier/prettier */
import type { FieldHook, User } from "payload";

export const resolveDuplicatePurchases: FieldHook<User> = async ({
  value,
  operation,
}) => {
  if ((operation === "create" || operation === "update") && value) {
    return Array.from(
      new Set(
        value?.map((purchase: { id: string }) =>
          typeof purchase === "string" ? purchase : purchase.id,
        ) || [],
      ),
    );
  }

  return;
};
