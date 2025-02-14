"use client";

import { useState } from "react";
import { Card, CardBody, CardFooter } from "@heroui/card";
import { Button } from "@heroui/button";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";

import { useDeckStore } from "@/stores/deckStore";
import { CardType } from "@/types/deck";

export function DeckView() {
  const {
    currentlySelectedDeck,
    deleteCard,
    currentCard,
    setCurrentCard,
    addCard,
  } = useDeckStore();
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);
  const [newCardQuestion, setNewCardQuestion] = useState("");
  const [newCardAnswer, setNewCardAnswer] = useState("");
  const [successMessage, setSuccessMessage] = useState("");

  const nextCard = () => {
    setShowAnswer(false);
    if (currentlySelectedDeck && currentCard) {
      const currentIndex = currentlySelectedDeck.cards.findIndex(
        (card: CardType) => card.id === currentCard.id,
      );
      const nextCard = currentlySelectedDeck.cards[currentIndex + 1];

      setCurrentCard(nextCard || currentCard);
    }
  };

  const prevCard = () => {
    setShowAnswer(false);
    if (currentlySelectedDeck && currentCard) {
      const currentIndex = currentlySelectedDeck.cards.findIndex(
        (card: CardType) => card.id === currentCard.id,
      );
      const prevCard = currentlySelectedDeck.cards[currentIndex - 1];

      setCurrentCard(prevCard || currentCard);
    }
  };

  const handleAddCard = () => {
    if (!newCardQuestion.trim() || !newCardAnswer.trim()) return;

    addCard(newCardQuestion, newCardAnswer);
    setNewCardQuestion("");
    setNewCardAnswer("");
    setSuccessMessage("Card added successfully!");

    // Clear success message after 3 seconds
    setTimeout(() => {
      setSuccessMessage("");
    }, 3000);
  };

  return (
    <div
      className="min-h-screen bg-neutral-50 p-8"
      style={{ marginLeft: "240px" }}
    >
      <div className="max-w-4xl mx-auto">
        {currentlySelectedDeck?.cards &&
          currentlySelectedDeck.cards.length > 0 &&
          currentlySelectedDeck.cards.map((card: CardType) =>
            currentCard?.id === card.id ? (
              <Card
                key={card.question}
                className="w-full min-h-[400px] shadow-lg hover:shadow-xl transition-shadow duration-200"
              >
                <CardBody className="flex justify-center h-full items-center p-8">
                  <div className="text-2xl text-neutral-800 text-center">
                    {showAnswer ? card.answer : card.question}
                  </div>
                </CardBody>
                <CardFooter className="flex justify-center gap-4 p-6 border-t border-neutral-200">
                  <Button
                    className="hover:bg-neutral-100"
                    variant="bordered"
                    onPress={prevCard}
                  >
                    Previous
                  </Button>
                  <Button
                    className="bg-primary-600 hover:bg-primary-700 text-white min-w-32"
                    onPress={() => setShowAnswer(!showAnswer)}
                  >
                    {showAnswer ? "Show Question" : "Show Answer"}
                  </Button>
                  <Button
                    className="hover:bg-neutral-100"
                    variant="bordered"
                    onPress={nextCard}
                  >
                    Next
                  </Button>
                </CardFooter>
              </Card>
            ) : null,
          )}

        {/* Card management buttons */}
        <div className="fixed bottom-8 right-8 flex gap-4">
          <Button
            className="bg-primary-600 hover:bg-primary-700 text-white shadow-lg"
            onPress={() => setShowAddCardModal(true)}
          >
            Add Card
          </Button>
          <Button
            className="bg-red-500 hover:bg-red-600 text-white shadow-lg"
            onPress={() => {
              if (currentlySelectedDeck && currentCard) {
                deleteCard(currentCard);
              }
            }}
          >
            Delete Card
          </Button>
        </div>

        {/* Add Card Modal */}
        <Modal
          className="bg-white rounded-lg shadow-xl"
          isOpen={showAddCardModal}
          onClose={() => setShowAddCardModal(false)}
        >
          <ModalContent>
            <ModalHeader className="border-b border-neutral-200 p-4">
              <h2 className="text-xl font-semibold">Add New Card</h2>
            </ModalHeader>
            <ModalBody className="p-6 space-y-4">
              {successMessage && (
                <div className="bg-green-50 border-l-4 border-green-400 p-4 mb-4">
                  <div className="flex">
                    <div className="ml-3">
                      <p className="text-sm text-green-700">{successMessage}</p>
                    </div>
                  </div>
                </div>
              )}
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
                  value={newCardQuestion}
                  onChange={(e) => setNewCardQuestion(e.target.value)}
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
                  value={newCardAnswer}
                  onChange={(e) => setNewCardAnswer(e.target.value)}
                />
              </div>
            </ModalBody>
            <ModalFooter className="border-t border-neutral-200 p-4">
              <div className="flex justify-end gap-3">
                <Button
                  variant="bordered"
                  onPress={() => setShowAddCardModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                  onPress={handleAddCard}
                >
                  Add Card
                </Button>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
