// import type { Access } from "payload";
import { PayloadRequest } from "payload";

export const lastLoggedInTenant = (req: PayloadRequest): string | null => {
  const { user } = req;

  // Check if lastLoggedInTenant is a number (tenant ID) or a Tenant object with an id
  const lastTenant = user?.lastLoggedInTenant;

  if (typeof lastTenant === "number") {
    // If it's a number, return it as a string
    return lastTenant.toString();
  } else if (
    lastTenant &&
    typeof lastTenant === "object" &&
    "id" in lastTenant
  ) {
    // If it's a Tenant object, return the id as a string (convert to string just in case)
    return String(lastTenant.id); // This ensures that both numbers and strings are safely returned as strings
  }

  // If no valid tenant is found, return null
  return null;
};
