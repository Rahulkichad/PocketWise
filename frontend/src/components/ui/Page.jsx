import React from "react";
import clsx from "classnames";

export default function Page({
  title,
  subtitle,
  actions,
  className,
  children,
}) {
  return (
    <div className={clsx("space-y-5", className)}>
      <div className="pw-header-gradient border-b">
        <div className="container px-4 py-6">
          <div className="flex items-center justify-between gap-4">
            <div>
              {title && <h1 className="pw-h1">{title}</h1>}
              {subtitle && (
                <p className="text-sm text-muted mt-1">{subtitle}</p>
              )}
            </div>
            {actions && (
              <div className="flex items-center gap-2">{actions}</div>
            )}
          </div>
        </div>
      </div>
      <div className="container px-4">{children}</div>
    </div>
  );
}
