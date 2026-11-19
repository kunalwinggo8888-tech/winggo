/** Type declarations for the original Ludo.js engine (logic untouched). */
export declare class Ludo {
  currentPositions: Record<string, number[]>;
  hooks: {
    onPosition: ((player: string, piece: number, position: number) => void) | null;
    onDiceRolled: ((diceValue: number) => void) | null;
    onTurnChange: ((playerIndex: number) => void) | null;
    onWin: ((player: string) => void) | null;
    canRoll: () => boolean;
    canAct: (player: string) => boolean;
  };
  turnIndex: number;
  diceValue: number;
  turn: number;
  state: string;
  constructor();
  destroy(): void;
  onDiceClick(player?: string): void;
  handlePieceClick(player: string, piece: string | number): void;
  resetGame(): void;
  getEligiblePieces(player: string): number[];
  hasPlayerWon(player: string): boolean;
  externalRoll(player: string | null, value: number): void;
  applyExternalTurn(playerIndex: number): void;
  applyExternalPositions(positions: Record<string, number[]> | null): void;
  resetFromState(positions: Record<string, number[]> | null, turnIndex?: number): void;
}
