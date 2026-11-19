/** Type declarations for the original UI.js (logic untouched; init() added). */
export declare class UI {
  static init(): void;
  static listenDiceClick(callback: () => void): () => void;
  static listenRollClick(callback: () => void): () => void;
  static listenResetClick(callback: () => void): () => void;
  static listenPieceClick(callback: (event: MouseEvent) => void): () => void;
  static setPiecePosition(player: string, piece: number, newPosition: number): void;
  static setTurn(index: number): void;
  static enableDice(player?: string): void;
  static disableDice(player?: string): void;
  static setDiceButton(enabled: boolean): void;
  static highlightPieces(player: string, pieces: number[]): void;
  static unhighlightPieces(): void;
  static setDiceValue(value: number): void;
}
