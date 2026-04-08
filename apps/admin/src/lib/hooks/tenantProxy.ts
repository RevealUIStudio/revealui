import type { RevealHandler, RevealRequest } from '@revealui/core';

// Extend User type to include userID
interface UserWithID {
  userID: string;
}

export const tenantProxy: RevealHandler = async (req: RevealRequest): Promise<Response> => {
  const logs = req?.revealui?.logger?.info?.bind(req.revealui.logger);
  const userID = req.query?.userID as string | undefined;

  if (!req.user) {
    const message = 'No user found';
    logs?.(message);
    return new Response(message, { status: 401 });
  }

  // Cast user to UserWithID to include userID property
  const userWithID = req.user as typeof req.user & UserWithID;

  if (!userWithID.userID) {
    const message = `No ID found for user ${userID}`;
    logs?.(message);
    return new Response(message, { status: 400 });
  }

  if (userWithID.userID !== userID) {
    const message = `User ID ${userWithID.userID} does not match ${userID}`;
    logs?.(message);
    return new Response(message, { status: 403 });
  }

  return new Response(null, { status: 200 });
};
