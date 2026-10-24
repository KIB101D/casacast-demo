"use client";

import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { useAdminI18n } from "@/i18n/admin/client";
import { deleteProperty } from "./actions";

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useAdminI18n();
  return (
    <Button type="submit" variant="danger" disabled={pending}>
      {pending ? t.common.deleting : t.common.delete}
    </Button>
  );
}

export function DeletePropertyButton({ id }: { id: string }) {
  const { t } = useAdminI18n();
  return (
    <form
      action={deleteProperty.bind(null, id)}
      onSubmit={(event) => {
        if (!window.confirm(t.editor.confirmDelete)) event.preventDefault();
      }}
    >
      <SubmitButton />
    </form>
  );
}
