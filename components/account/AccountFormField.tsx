import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import {
  FormField,
  SelectField,
  SurfaceCard,
  TextInput,
} from "@/components/ui/FormControls";

interface AccountFormFieldProps {
  id: string;
  label: string;
  hint?: string;
  error?: string;
  children?: ReactNode;
}

export function AccountFormField(props: AccountFormFieldProps) {
  return <FormField {...props} />;
}

export function AccountTextInput(props: InputHTMLAttributes<HTMLInputElement>) {
  return <TextInput {...props} />;
}

export function AccountSelect({
  children,
  ...props
}: SelectHTMLAttributes<HTMLSelectElement> & { children: ReactNode }) {
  return <SelectField {...props}>{children}</SelectField>;
}

export function AccountCard({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <SurfaceCard title={title} description={description}>
      {children}
    </SurfaceCard>
  );
}
