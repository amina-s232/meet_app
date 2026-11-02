"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";

type FieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  error?: string;
};

const inputClass = (error?: string) =>
  `block w-full rounded-lg border bg-white px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-400 shadow-sm outline-none transition focus:ring-2 ${
    error
      ? "border-red-400 focus:border-red-500 focus:ring-red-100"
      : "border-gray-300 focus:border-blue-500 focus:ring-blue-100"
  }`;

const labelClass = "mb-1.5 block text-sm font-medium text-gray-700";

export const TextField = forwardRef<HTMLInputElement, FieldProps>(function TextField(
  { label, error, id, ...props },
  ref
) {
  const inputId = id ?? props.name;
  return (
    <div>
      <label htmlFor={inputId} className={labelClass}>
        {label}
      </label>
      <input
        {...props}
        ref={ref}
        id={inputId}
        aria-invalid={!!error}
        className={inputClass(error)}
      />
      {error && (
        <p className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});

export const PasswordField = forwardRef<HTMLInputElement, FieldProps>(function PasswordField(
  { label, error, id, ...props },
  ref
) {
  const [show, setShow] = useState(false);
  const inputId = id ?? props.name;
  return (
    <div>
      <label htmlFor={inputId} className={labelClass}>
        {label}
      </label>
      <div className="relative">
        <input
          {...props}
          ref={ref}
          id={inputId}
          type={show ? "text" : "password"}
          aria-invalid={!!error}
          className={`${inputClass(error)} pr-11`}
        />
        <button
          type="button"
          onClick={() => setShow((s) => !s)}
          aria-label={show ? "Hide password" : "Show password"}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-500 hover:text-gray-700"
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {error && (
        <p className="mt-1.5 text-sm text-red-600" role="alert">
          {error}
        </p>
      )}
    </div>
  );
});