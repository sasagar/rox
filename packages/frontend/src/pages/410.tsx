"use client";

import { Trans } from "@lingui/react/macro";
import { ErrorPage } from "../components/ErrorPage";

/**
 * 410 Gone page
 * Displayed when a requested resource has been permanently deleted
 * Used for deleted ActivityPub actors, notes, etc.
 */
export default function GonePage() {
  return (
    <ErrorPage
      statusCode={410}
      title={<Trans>Gone</Trans>}
      description={<Trans>This content has been permanently deleted and is no longer available.</Trans>}
    />
  );
}

export const getConfig = async () => {
  return {
    render: "static",
  };
};
