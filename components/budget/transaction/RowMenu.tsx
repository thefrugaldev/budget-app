import { Menu } from "@base-ui/react/menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

/**
 * Per-row overflow (`…`) menu with Edit / Delete (story 43). Always visible on
 * mobile/touch; on desktop the trigger stays hidden until the row is hovered
 * or something inside it gains focus, keeping the trailing column quiet.
 */
export function RowMenu({ onEdit, onDelete }: { onEdit: () => void; onDelete: () => void }) {
  return (
    <Menu.Root>
      <Menu.Trigger
        aria-label="Row actions"
        data-row-menu
        tabIndex={-1}
        // Always visible on mobile/touch; on desktop the ⋯ stays hidden until
        // the row is hovered or something inside it gains focus (keyboard),
        // and while its own menu is open — keeps the trailing column quiet.
        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-100 transition-opacity hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100 md:data-[popup-open]:opacity-100"
      >
        <MoreHorizontal className="size-4" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={4} align="end" className="z-30 outline-none">
          <Menu.Popup className="min-w-40 rounded-xl bg-card p-1 text-sm shadow-xl ring-1 ring-border outline-none">
            <Menu.Item
              onClick={onEdit}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 outline-none data-[highlighted]:bg-muted"
            >
              <Pencil className="size-4 text-muted-foreground" aria-hidden />
              Edit
            </Menu.Item>
            <Menu.Item
              onClick={onDelete}
              className="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-destructive outline-none data-[highlighted]:bg-destructive/10"
            >
              <Trash2 className="size-4" aria-hidden />
              Delete
            </Menu.Item>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
