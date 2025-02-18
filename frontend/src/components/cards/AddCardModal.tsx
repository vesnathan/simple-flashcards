import { useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";

interface AddCardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (question: string, answer: string) => void;
}

export function AddCardModal({ isOpen, onClose, onSubmit }: AddCardModalProps) {
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");

  const handleSubmit = () => {
    if (question.trim() && answer.trim()) {
      onSubmit(question.trim(), answer.trim());
      setQuestion("");
      setAnswer("");
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose}>
      <ModalContent>
        <ModalHeader className="border-b border-neutral-200 p-4">
          <h2 className="text-xl font-semibold">Add New Card</h2>
        </ModalHeader>
        <ModalBody className="p-6 space-y-4">
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-neutral-700"
              htmlFor="question"
            >
              Question
            </label>
            <input
              className="w-full p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              id="question"
              placeholder="Enter your question"
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <label
              className="text-sm font-medium text-neutral-700"
              htmlFor="answer"
            >
              Answer
            </label>
            <input
              className="w-full p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              id="answer"
              placeholder="Enter your answer"
              type="text"
              value={answer}
              onChange={(e) => setAnswer(e.target.value)}
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
              disabled={!question.trim() || !answer.trim()}
              onPress={handleSubmit}
            >
              Add Card
            </Button>
          </div>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
