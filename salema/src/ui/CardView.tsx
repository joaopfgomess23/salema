import { Card, Suit, isQueenOfSpades } from '../engine';

const SUIT_SYMBOL: Record<Suit, string> = {
  clubs: '\u2663', // ♣
  diamonds: '\u2666', // ♦
  spades: '\u2660', // ♠
  hearts: '\u2665', // ♥
};

const RANK_LABEL: Record<string, string> = {
  A: 'A',
  K: 'R', // Rei
  J: 'V', // Valete
  Q: 'D', // Dama
  '7': '7',
  '6': '6',
  '5': '5',
  '4': '4',
  '3': '3',
  '2': '2',
};

interface CardViewProps {
  card?: Card;
  faceDown?: boolean;
  size?: 'sm' | 'md' | 'lg';
  highlight?: boolean; // jogável agora
  dimmed?: boolean; // não jogável
  onClick?: () => void;
}

export function CardView({
  card,
  faceDown = false,
  size = 'md',
  highlight = false,
  dimmed = false,
  onClick,
}: CardViewProps) {
  if (faceDown || !card) {
    return <div className={`card card--back card--${size}`} aria-hidden="true" />;
  }

  const red = card.suit === 'hearts' || card.suit === 'diamonds';
  const salema = isQueenOfSpades(card);
  const classes = [
    'card',
    `card--${size}`,
    red ? 'card--red' : 'card--dark',
    salema ? 'card--salema' : '',
    highlight ? 'card--playable' : '',
    dimmed ? 'card--dimmed' : '',
    onClick ? 'card--button' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const label = `${RANK_LABEL[card.rank]} de ${suitName(card.suit)}`;

  const content = (
    <>
      <span className="card__corner card__corner--tl">
        <span className="card__rank">{RANK_LABEL[card.rank]}</span>
        <span className="card__suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      <span className="card__pip">{SUIT_SYMBOL[card.suit]}</span>
      <span className="card__corner card__corner--br">
        <span className="card__rank">{RANK_LABEL[card.rank]}</span>
        <span className="card__suit">{SUIT_SYMBOL[card.suit]}</span>
      </span>
      {salema && <span className="card__tag">Salema</span>}
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={classes} onClick={onClick} aria-label={`Jogar ${label}`}>
        {content}
      </button>
    );
  }
  return (
    <div className={classes} aria-label={label}>
      {content}
    </div>
  );
}

function suitName(suit: Suit): string {
  return { clubs: 'Paus', diamonds: 'Ouros', spades: 'Espadas', hearts: 'Copas' }[suit];
}
