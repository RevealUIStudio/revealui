import type { CollectionConfig } from "@revealui/cms";
import { adminsOrOrderedBy } from "./access/adminsOrOrderedBy";
import { clearUserCart } from "./hooks/clearUserCart";
import { populateOrderedBy } from "./hooks/populateOrderedBy";
import { updateUserPurchases } from "./hooks/updateUserPurchases";
import { isAdmin, isAdminOrLoggedIn } from "../../access";

export const Orders: CollectionConfig = {
  slug: "orders",
  admin: {
    useAsTitle: "createdAt",
    defaultColumns: ["createdAt", "orderedBy"],
    preview: (doc: Record<string, unknown>) =>
      `${process.env.REVEALUI_PUBLIC_SERVER_URL}/orders/${doc.id}`,
  },
  hooks: {
    afterChange: [updateUserPurchases, clearUserCart],
  },
  access: {
    read: adminsOrOrderedBy,
    update: isAdmin,
    create: isAdminOrLoggedIn,
    delete: isAdmin,
  },
  fields: [
    {
      name: "orderedBy",
      type: "relationship",
      relationTo: "users",
      hooks: {
        beforeChange: [populateOrderedBy],
      },
    },
    {
      name: "stripePaymentIntentID",
      label: "Stripe Payment Intent ID",
      type: "text",
      admin: {
        position: "sidebar",
        components: {
          Field: "/src/lib/collections/Orders/ui/LinkToPaymentIntent",
        },
      },
    },
    {
      name: "total",
      type: "number",
      required: true,
      min: 0,
    },
    {
      name: "items",
      type: "array",
      fields: [
        {
          name: "product",
          type: "relationship",
          relationTo: "products",
          required: true,
        },
        {
          name: "price",
          type: "number",
          min: 0,
        },
        {
          name: "quantity",
          type: "number",
          min: 0,
        },
      ],
    },
  ],
};
