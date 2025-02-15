import { useState } from "react";
import { Button } from "@heroui/button";
import { Modal, ModalContent, ModalHeader, ModalBody, ModalFooter } from "@heroui/modal";

import { authService } from "@/services/auth";

interface ConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  email: string;
  onConfirmed: () => void;
}

export function ConfirmationModal({ isOpen, onClose, email, onConfirmed }: ConfirmationModalProps) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await authService.confirmSignUp(email, code);
      onConfirmed();
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to confirm registration");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <form onSubmit={handleSubmit}>
          <ModalHeader className="border-b border-neutral-200 p-4">
            <h2 className="text-xl font-semibold">Confirm your email</h2>
          </ModalHeader>

          <ModalBody className="p-6 space-y-4">
            {error && (
              <div className="bg-red-50 border-l-4 border-red-400 p-4">
                <p className="text-sm text-red-700">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <p className="text-sm text-neutral-600">
                We sent a confirmation code to {email}. Please enter it below.
              </p>
              <input
                required
                className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                placeholder="Enter confirmation code"
                value={code}
                onChange={(e) => setCode(e.target.value)}
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
                type="submit"
                disabled={loading || !code}
              >
                {loading ? "Confirming..." : "Confirm"}
              </Button>
            </div>
          </ModalFooter>
        </form>
      </ModalContent>
    </Modal>
  );
}
