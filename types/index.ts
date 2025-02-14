import { SVGProps } from "react";

export type IconSvgProps = SVGProps<SVGSVGElement> & {
  size?: number;
};

export interface CardType {
  id: number;
  answer: string;
  question: string;
}

export interface Deck {
  title: string;
  cards: CardType[];
}

export type Decks = Deck[];
