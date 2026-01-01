/* eslint-disable prettier/prettier */
import { FieldHook } from "revealui/cms";

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
