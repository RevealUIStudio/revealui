/* eslint-disable @typescript-eslint/no-explicit-any */
import RichText from "../../../components/RichText";
import React from "react";

import { Width } from "../Width";

export const Message: React.FC<{
  message: Record<string, any>;
}> = ({ message }) => {
  return (
    <Width className="my-12" width="100">
      {message && <RichText content={message} />}
    </Width>
  );
};
