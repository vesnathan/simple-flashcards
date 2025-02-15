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
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

import { LocalDeckWarning } from "./LocalDeckWarning";

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
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const currentIndex = currentCard
    ? currentlySelectedDeck?.cards.findIndex(
        (card: CardType) => card.id === currentCard.id,
      )
    : -1;

  const isFirstCard = currentIndex === 0;
  const isLastCard =
    currentIndex === (currentlySelectedDeck?.cards.length ?? 0) - 1;

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

    // Just clear the form fields but don't close the modal
    setNewCardQuestion("");
    setNewCardAnswer("");

    // Set first card if deck was empty
    if (
      currentlySelectedDeck &&
      (!currentlySelectedDeck.cards || currentlySelectedDeck.cards.length === 1)
    ) {
      setCurrentCard(currentlySelectedDeck.cards[0]);
    }

    toast.success("Card added successfully!");
  };

  const handleDeleteCard = () => {
    if (currentCard) {
      deleteCard(currentCard);
      setShowDeleteModal(false);
    }
  };

  return (
    <div
      className="min-h-screen bg-neutral-50 p-8"
      style={{ marginLeft: "240px" }}
    >
      <div className="max-w-4xl mx-auto mt-8">
        {currentlySelectedDeck?.isLocal && <LocalDeckWarning />}

        {/* Show select deck message if no deck selected */}
        {!currentlySelectedDeck && (
          <div className="text-center py-8">
            <p className="text-gray-500">Select a deck to get started</p>
          </div>
        )}

        {/* Show no cards message only if deck is selected but empty */}
        {currentlySelectedDeck &&
          (!currentlySelectedDeck.cards ||
            currentlySelectedDeck.cards.length === 0) && (
            <div className="text-center py-8">
              <p className="text-gray-500">No cards in this deck yet.</p>
              <Button
                className="mt-4 bg-primary-600 hover:bg-primary-700 text-white"
                onPress={() => setShowAddCardModal(true)}
              >
                Add Your First Card
              </Button>
            </div>
          )}

        {/* Only show card if we have cards and a current card */}
        {currentlySelectedDeck?.cards &&
          currentlySelectedDeck.cards.length > 0 &&
          currentCard && (
            <div className="space-y-6">
              <Card className="w-full min-h-[400px] shadow-lg hover:shadow-xl transition-shadow duration-200">
                <CardBody className="flex justify-center h-full items-center p-8">
                  <div className="text-2xl text-neutral-800 text-center">
                    {showAnswer ? currentCard.answer : currentCard.question}
                  </div>
                </CardBody>
                <CardFooter className="flex justify-center gap-4 p-6 border-t border-neutral-200">
                  <Button
                    className="hover:bg-neutral-100"
                    disabled={isFirstCard}
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
                    disabled={isLastCard}
                    variant="bordered"
                    onPress={nextCard}
                  >
                    Next
                  </Button>
                </CardFooter>
              </Card>

              {/* Card management buttons */}
              <div className="flex justify-center gap-4 mt-12">
                <Button
                  className="bg-primary-600 hover:bg-primary-700 text-white"
                  onPress={() => setShowAddCardModal(true)}
                >
                  Add Card
                </Button>
                <Button
                  className="bg-red-500 hover:bg-red-600 text-white"
                  disabled={!currentCard}
                  onPress={() => setShowDeleteModal(true)}
                >
                  Delete Card
                </Button>
              </div>
            </div>
          )}

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

        {/* Delete Confirmation Modal */}
        <Modal
          isOpen={showDeleteModal}
          onClose={() => setShowDeleteModal(false)}
        >
          <ModalContent>
            <ModalHeader className="border-b border-neutral-200 p-4">
              <h2 className="text-xl font-semibold">Delete Card</h2>
            </ModalHeader>
            <ModalBody className="p-6">
              <p>
                Are you sure you want to delete this card? This action cannot be
                undone.
              </p>
            </ModalBody>
            <ModalFooter className="border-t border-neutral-200 p-4">
              <div className="flex justify-end gap-3">
                <Button
                  variant="bordered"
                  onPress={() => setShowDeleteModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-red-500 hover:bg-red-600 text-white"
                  onPress={handleDeleteCard}
                >
                  Delete
                </Button>
              </div>
            </ModalFooter>
          </ModalContent>
        </Modal>
      </div>
    </div>
  );
}
