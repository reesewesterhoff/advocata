/** Props accepted by `FormField`. */
export type FormFieldProps = {
  /** The `id` of the inner form control, linked to the `<label>`. */
  readonly id: string;
  /** Human-readable label text rendered above the control. */
  readonly label: string;
  /** Validation error message. When present, renders below the control in red. */
  readonly error?: string;
  /** The form control(s) to render between the label and the error message. */
  readonly children: React.ReactNode;
};

/**
 * Renders a labelled form field with an optional inline error message.
 *
 * Handles the repetitive label + control + error structure so each field
 * only specifies what is unique to it.
 *
 * @param props - See `FormFieldProps`.
 */
export const FormField = ({ id, label, error, children }: FormFieldProps) => (
  <div className="space-y-2">
    <label className="text-sm font-medium" htmlFor={id}>
      {label}
    </label>
    {children}
    {error ? <p className="text-sm text-red-600">{error}</p> : null}
  </div>
);
