import type { FieldHook } from "payload";

// import type { Order } from "../../../types/payload";

// export const populateOrderedBy: FieldHook<Order> = async ({
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const populateOrderedBy: FieldHook<any> = async ({
  req,
  operation,
  value,
}) => {
  if ((operation === "create" || operation === "update") && !value) {
    return req?.user?.id;
  }

  return value;
};
