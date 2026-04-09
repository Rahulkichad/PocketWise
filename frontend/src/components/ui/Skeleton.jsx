import React from "react";
import clsx from "classnames";

export default function Skeleton({ className }) {
  return <div className={clsx("pw-skeleton", className)} />;
}
