// import type { Order } from "../../../types/revealui";

// export const populateOrderedBy: FieldHook<Order> = async ({
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const populateOrderedBy = async ({
  req,
  operation,
  value,
}: {
  req?: any
  operation?: string
  value?: any
}) => {
  if ((operation === 'create' || operation === 'update') && !value) {
    return req?.user?.id
  }

  return value
}
