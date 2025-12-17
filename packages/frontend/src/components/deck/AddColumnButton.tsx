"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "../ui/Button";
import { AddColumnDialog } from "./AddColumnDialog";

/**
 * Button to add a new column to the deck
 *
 * Opens a dialog where the user can select the column type and configuration.
 */
export function AddColumnButton() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        onPress={() => setIsDialogOpen(true)}
        className="w-12 h-12 rounded-full bg-white dark:bg-gray-800 shadow-md hover:shadow-lg transition-shadow"
        aria-label="Add column"
      >
        <Plus className="w-6 h-6" />
      </Button>

      <AddColumnDialog
        isOpen={isDialogOpen}
        onClose={() => setIsDialogOpen(false)}
      />
    </>
  );
}
