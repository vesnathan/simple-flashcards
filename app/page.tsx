"use client";

import { useEffect, useState } from "react";
import {
  Modal,
  ModalContent,
  ModalHeader,
  ModalBody,
  ModalFooter,
} from "@heroui/modal";
import { Button } from "@heroui/button";
import { Card, CardBody, CardFooter } from "@heroui/card";

import { MainLayout } from "@/components/Layouts/MainLayout";
import { CardType } from "@/types";
import { useDeckStore } from "@/stores/deckStore";

export default function Page() {
  const { currentlySelectedDeck, deleteCard, currentCard, setCurrentCard } =
    useDeckStore();
  const [newCardQuestion, setNewCardQuestion] = useState("");
  const [newCardAnswer, setNewCardAnswer] = useState("");
  const [showAddCardModal, setShowAddCardModal] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  const nextCard = () => {
    setShowAnswer(false);
    if (currentlySelectedDeck && currentCard) {
      const currentIndex = currentlySelectedDeck.cards.findIndex(
        (card) => card.id === currentCard.id,
      );
      const nextCard = currentlySelectedDeck.cards[currentIndex + 1];

      setCurrentCard(nextCard || currentCard);
    }
  };

  const prevCard = () => {
    setShowAnswer(false);
    if (currentlySelectedDeck && currentCard) {
      const currentIndex = currentlySelectedDeck.cards.findIndex(
        (card) => card.id === currentCard.id,
      );
      const prevCard = currentlySelectedDeck.cards[currentIndex - 1];

      setCurrentCard(prevCard || currentCard);
    }
  };

  useEffect(() => {
    if (currentlySelectedDeck && currentlySelectedDeck.cards.length > 0) {
      setCurrentCard(currentlySelectedDeck.cards[0]);
    }
  }, [currentlySelectedDeck, setCurrentCard]);

  return (
    <MainLayout>
      <div
        className="min-h-screen bg-neutral-50 p-8"
        style={{ marginLeft: "240px" }}
      >
        <div className="max-w-4xl mx-auto">
          {currentlySelectedDeck?.cards &&
            currentlySelectedDeck?.cards.length > 0 &&
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
                      variant="bordered"
                      onPress={prevCard}
                      className="hover:bg-neutral-100"
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
                      variant="bordered"
                      onPress={nextCard}
                      className="hover:bg-neutral-100"
                    >
                      Next
                    </Button>
                  </CardFooter>
                </Card>
              ) : null,
            )}

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

          <Modal
            isOpen={showAddCardModal}
            onClose={() => setShowAddCardModal(false)}
            className="bg-white rounded-lg shadow-xl"
          >
            <ModalContent>
              <ModalHeader className="border-b border-neutral-200 p-4">
                <h2 className="text-xl font-semibold">Add New Card</h2>
              </ModalHeader>
              <ModalBody className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Question</label>
                  <input
                    className="w-full p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                    placeholder="Enter your question"
                    type="text"
                    value={newCardQuestion}
                    onChange={(e) => setNewCardQuestion(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-neutral-700">Answer</label>
                  <input
                    className="w-full p-2 border border-neutral-300 rounded-md focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                    onPress={() => {/* Add card logic */}}
                  >
                    Add Card
                  </Button>
                </div>
              </ModalFooter>
            </ModalContent>
          </Modal>
        </div>
      </div>
    </MainLayout>
  );
}
