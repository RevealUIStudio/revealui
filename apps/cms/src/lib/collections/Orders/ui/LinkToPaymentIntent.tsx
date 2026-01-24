import type { TextField } from "@revealui/core";
import type React from "react";

const LinkToPaymentIntent: React.FC<TextField> = (props) => {
	const { name, label } = props;

	// const { value: stripePaymentIntentID } =
	//   useFormFields(([fields]) => fields[name]) || {};

	// const href = `https://dashboard.stripe.com/${
	//   import.meta.env.VITE_STRIPE_IS_TEST_KEY ? "test/" : ""
	// }payments/${stripePaymentIntentID}`;

	return (
		<div>
			<h1 style={{ fontSize: "1.5rem", marginBottom: "0.5rem" }}>{name}</h1>
			<p style={{ marginBottom: "0" }}>
				{typeof label === "string" ? label : "Stripe Payment Intent ID"}
			</p>
			{/* <Text {...props} label="" />
      <Select name="status" label="Status" options={["succeeded", "failed"]} /> */}
			{/* {Boolean(stripePaymentIntentID) && (
        <div>
          <div>
            <span
              className="label"
              style={{
                color: "#9A9A9A",
              }}
            >
              {`Manage in Stripe`}
            </span>
            <CopyToClipboard value={href} />
          </div>
          <div
            style={{
              overflow: "hidden",
              textOverflow: "ellipsis",
              fontWeight: "600",
            }}
          >
            <a
              href={`https://dashboard.stripe.com/${
                import.meta.env.VITE_STRIPE_IS_TEST_KEY ? "test/" : ""
              }customers/${stripePaymentIntentID}`}
              target="_blank"
              rel="noreferrer noopener"
            >
              {href}
            </a>
          </div>
        </div>
      )} */}
		</div>
	);
};

export default LinkToPaymentIntent;
