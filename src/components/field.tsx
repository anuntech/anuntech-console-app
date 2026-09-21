"use client";

import {
  Children,
  cloneElement,
  isValidElement,
  useId,
  useEffect,
  useRef,
  useState,
  type ReactElement,
  type ReactNode,
  type SyntheticEvent,
} from "react";

type ControlProps = {
  id?: string;
  type?: string;
  required?: boolean;
  value?: unknown;
  checked?: boolean;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean | "true" | "false" | "grammar" | "spelling";
};

function isControl(child: ReactNode): child is ReactElement<ControlProps> {
  return (
    isValidElement<ControlProps>(child) &&
    child.props.type !== "hidden" &&
    (typeof child.type !== "string" ||
      ["input", "select", "textarea"].includes(child.type))
  );
}

function validationMessage(
  field: HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement,
) {
  const validity = field.validity;
  if (validity.valueMissing) return "Preencha este campo obrigatório.";
  if (validity.typeMismatch && field.type === "email")
    return "Informe um e-mail válido, como nome@empresa.com.br.";
  if (validity.typeMismatch && field.type === "url")
    return "Informe um endereço válido, incluindo https://.";
  if (validity.tooShort && "minLength" in field)
    return `Use pelo menos ${field.minLength} caracteres.`;
  if (validity.tooLong && "maxLength" in field)
    return `Use no máximo ${field.maxLength} caracteres.`;
  if (field instanceof HTMLInputElement) {
    if (validity.rangeUnderflow)
      return `Informe um valor igual ou maior que ${field.min}.`;
    if (validity.rangeOverflow)
      return `Informe um valor igual ou menor que ${field.max}.`;
  }
  if (validity.patternMismatch)
    return "Confira o formato informado neste campo.";
  return field.validationMessage || "Confira o valor informado neste campo.";
}

/** Field renders inline validation instead of the browser bubble. Restore focus after errors render. */
export function focusFirstInvalid(form: HTMLFormElement) {
  requestAnimationFrame(() => {
    form
      .querySelector<HTMLElement>(
        "input:invalid, select:invalid, textarea:invalid",
      )
      ?.focus();
  });
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const generatedId = useId();
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState("");
  const items = Children.toArray(children);
  const control = items.find(isControl);
  const controlId = control?.props.id || `${generatedId}-control`;
  const hintId = `${generatedId}-hint`;
  const errorId = `${generatedId}-error`;
  const describedBy =
    [
      control?.props["aria-describedby"],
      hint ? hintId : undefined,
      error ? errorId : undefined,
    ]
      .filter(Boolean)
      .join(" ") || undefined;

  useEffect(() => {
    if (!error) return;
    // Lookups can update controlled fields without an input/change event.
    // Read native validity after the new value has reached the input, including masked controls.
    const frame = requestAnimationFrame(() => {
      const field = container.current?.querySelector<
        HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
      >('input:not([type="hidden"]), select, textarea');
      if (field) setError(field.validity.valid ? "" : validationMessage(field));
    });
    return () => cancelAnimationFrame(frame);
  }, [
    control?.props.value,
    control?.props.checked,
    control?.props.type,
    error,
  ]);

  function updateValidation(event: SyntheticEvent) {
    const target = event.target;
    if (
      target instanceof HTMLInputElement ||
      target instanceof HTMLSelectElement ||
      target instanceof HTMLTextAreaElement
    ) {
      if (error)
        setError(target.validity.valid ? "" : validationMessage(target));
    }
  }

  return (
    <div
      ref={container}
      className="field"
      data-form-field=""
      onInvalidCapture={(event) => {
        const target = event.target;
        if (
          target instanceof HTMLInputElement ||
          target instanceof HTMLSelectElement ||
          target instanceof HTMLTextAreaElement
        ) {
          event.preventDefault();
          setError(validationMessage(target));
        }
      }}
      onInputCapture={updateValidation}
      onChangeCapture={updateValidation}
    >
      <label className="field-label" htmlFor={controlId}>
        <span>{label.replace(/\s*\((opcional|obrigatório)\)/gi, "")}</span>
      </label>
      {items.map((child) =>
        child === control
          ? cloneElement(control, {
              id: controlId,
              "aria-describedby": describedBy,
              "aria-invalid": error ? true : control.props["aria-invalid"],
            })
          : child,
      )}
      {hint && <small id={hintId}>{hint}</small>}
      {error && (
        <small id={errorId} className="field-error">
          {error}
        </small>
      )}
    </div>
  );
}
