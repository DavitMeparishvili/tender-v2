import { cloneElement, type ReactElement, type ReactNode } from "react";

type ControlProps = Readonly<{
  id?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}>;

type FieldProps = Readonly<{
  id: string;
  label: string;
  description?: string | undefined;
  error?: string | undefined;
  children: ReactElement<ControlProps>;
  suffix?: ReactNode;
  requirement?: string;
}>;

export function Field({
  id,
  label,
  description,
  error,
  children,
  suffix,
  requirement,
}: FieldProps) {
  const describedBy = [
    description ? `${id}-description` : null,
    error ? `${id}-error` : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="form-field">
      <label htmlFor={id}>
        {label}
        {requirement ? (
          <span className="field-requirement" aria-hidden="true">
            {requirement}
          </span>
        ) : null}
      </label>
      {description ? (
        <p className="field-description" id={`${id}-description`}>
          {description}
        </p>
      ) : null}
      <div className="field-control">
        {cloneElement(children, {
          id,
          ...(describedBy ? { "aria-describedby": describedBy } : {}),
          ...(error ? { "aria-invalid": true } : {}),
        })}
        {suffix}
      </div>
      {error ? (
        <p className="field-error" id={`${id}-error`}>
          {error}
        </p>
      ) : null}
    </div>
  );
}
