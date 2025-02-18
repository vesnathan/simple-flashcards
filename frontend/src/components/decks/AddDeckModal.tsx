import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { useState } from "react";

interface AddDeckModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (title: string) => Promise<void>;
  onDeckCreated?: () => void; // Add this prop
}

export function AddDeckModal({
  isOpen,
  onClose,
  onSubmit,
  onDeckCreated,
}: AddDeckModalProps) {
  const [title, setTitle] = useState("");

  const handleSubmit = async () => {
    if (title.trim()) {
      await onSubmit(title.trim());
      setTitle("");
      onClose();
      // Call the callback after deck is created
      onDeckCreated?.();
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader className="border-b border-neutral-200 p-4">
          <h2 className="text-xl font-semibold">Create New Deck</h2>
        </ModalHeader>
        <ModalBody className="p-6">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-neutral-700"
              htmlFor="deckTitle"
            >
              Deck Title
            </label>
            <input
              className="w-full p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              id="deckTitle"
              placeholder="Enter deck title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
        </ModalBody>
        <ModalFooter className="border-t border-neutral-200 p-4">
          <div className="flex justify-end gap-3">
            <Button variant="bordered" onPress={onClose}>
              Cancel
            </Button>
            <Button
              className="bg-primary-600 hover:bg-primary-700 text-white"
              disabled={!title.trim()}
              onPress={handleSubmit}
            >
              Create Deck
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
