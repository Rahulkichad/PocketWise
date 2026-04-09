import React from "react";
import clsx from "classnames";

export default function Button({
  variant = "primary",
  className,
  children,
  ...rest
}) {
  const base = "pw-btn";
  const variants = {
    primary: "pw-btn-primary",
    ghost: "pw-btn-ghost",
  };
  return (
    <button className={clsx(base, variants[variant], className)} {...rest}>
      {children}
    </button>
  );
}
