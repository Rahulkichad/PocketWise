import React from "react";
import clsx from "classnames";

export default function Card({
  as: Tag = "div",
  hover = true,
  className,
  children,
  ...rest
}) {
  return (
    <Tag
      className={clsx("pw-card", hover && "pw-card-hover", className)}
      {...rest}
    >
      {children}
    </Tag>
  );
}
