/**
 * UI.js — copy of the original game's UI layer (owner: Kunal).
 * Source: C:\Users\Kunal\Desktop\game\ludo-game-using-html-css-and-javascript
 *
 * INTEGRATION CHANGES (minimal, logic identical):
 *  1. The module-level document.querySelector calls moved into UI.init() —
 *     in the React app the module is imported before the markup exists.
 *  2. Every listen*(callback) now ALSO returns an unsubscribe function so the
 *     React page can remove listeners on unmount / rematch.
 *  3. The 2-player mode has TWO identical dice widgets (one per player's
 *     home). listenRollClick binds BOTH; enableDice(player)/disableDice(player)
 *     toggle only that player's widget (plus the hidden #dice-btn toggle,
 *     kept exactly as before). setTurn highlighting and all position math are
 *     byte-for-byte the original implementation.
 */
import { COORDINATES_MAP, PLAYERS, STEP_LENGTH } from './constants.js';

export class UI {
    static diceButtonElement = null;
    static rollElement = null;
    static playerPiecesElements = { P1: [], P2: [], P3: [], P4: [] };
    static bound = false;

    /** Must be called once after the game markup is in the DOM. */
    static init() {
        if (UI.bound) return;
        UI.bound = true;
        UI.diceButtonElement = document.querySelector('#dice-btn');
        UI.rollElement = document.querySelector('.roll');
        UI.playerPiecesElements = {
            P1: document.querySelectorAll('[player-id="P1"].player-piece'),
            P2: document.querySelectorAll('[player-id="P2"].player-piece'),
            P3: document.querySelectorAll('[player-id="P3"].player-piece'),
            P4: document.querySelectorAll('[player-id="P4"].player-piece'),
        }
    }

    static listenDiceClick(callback) {
        UI.diceButtonElement.addEventListener('click', callback);
        return () => UI.diceButtonElement.removeEventListener('click', callback);
    }

    static listenRollClick(callback) {
        // the two visible 3D-dice widget buttons (one per player) — same
        // original Ludo.js wiring, extended to both players' widgets
        const els = [
            document.querySelector('.containeer-p1 .roll'),
            document.querySelector('.containeer-p2 .roll'),
        ].filter(Boolean);
        const removers = els.map((el) => {
            el.addEventListener('click', callback);
            return () => el.removeEventListener('click', callback);
        });
        return () => removers.forEach((rm) => rm());
    }

    static listenResetClick(callback) {
        const el = document.querySelector('button#reset-btn');
        el.addEventListener('click', callback);
        return () => el.removeEventListener('click', callback);
    }

    static listenPieceClick(callback) {
        const el = document.querySelector('.player-pieces');
        el.addEventListener('click', callback);
        return () => el.removeEventListener('click', callback);
    }

    /**
     * 
     * @param {string} player 
     * @param {Number} piece 
     * @param {Number} newPosition 
     */
    static setPiecePosition(player, piece, newPosition) {
        const els = UI.playerPiecesElements;
        if (!els[player] || !els[player][piece]) {
            console.error(`Player element of given player: ${player} and piece: ${piece} not found`);
            return;
        }

        const [x, y] = COORDINATES_MAP[newPosition];

        const pieceElement = els[player][piece];
        pieceElement.style.top = y * STEP_LENGTH + '%';
        pieceElement.style.left = x * STEP_LENGTH + '%';
    }

    static setTurn(index) {
        if (index < 0 || index >= PLAYERS.length) {
            console.error('index out of bound!');
            return;
        }

        const player = PLAYERS[index];

        // Display player ID
        const activeLabel = document.querySelector('.active-player span');
        if (activeLabel) activeLabel.innerText = player;

        const activePlayerBase = document.querySelector('.player-base.highlight');
        if (activePlayerBase) {
            activePlayerBase.classList.remove('highlight');
        }
        // highlight
        const base = document.querySelector(`[player-id="${player}"].player-base`);
        if (base) base.classList.add('highlight');
    }

    static enableDice(player) {
        const el = player ? document.querySelector(`.containeer-${player.toLowerCase()} .roll`) : UI.rollElement;
        if (el) el.removeAttribute('disabled');
    }

    static disableDice(player) {
        const el = player ? document.querySelector(`.containeer-${player.toLowerCase()} .roll`) : UI.rollElement;
        if (el) el.setAttribute('disabled', '');
    }

    /** Hidden legacy #dice-btn (display:none in the original) — kept in sync. */
    static setDiceButton(enabled) {
        if (!UI.diceButtonElement) return;
        if (enabled) UI.diceButtonElement.removeAttribute('disabled');
        else UI.diceButtonElement.setAttribute('disabled', '');
    }

    /**
     * 
     * @param {string} player 
     * @param {Number[]} pieces 
     */
    static highlightPieces(player, pieces) {
        pieces.forEach(piece => {
            const pieceElement = UI.playerPiecesElements[player][piece];
            if (pieceElement) pieceElement.classList.add('highlight');
        });
    }

    static unhighlightPieces() {
        document.querySelectorAll('.player-piece.highlight').forEach(ele => {
            ele.classList.remove('highlight');
        });
    }

    static setDiceValue(value) {
        const el = document.querySelector('.dice-value');
        if (el) el.innerText = value;
    }
}

// UI.setPiecePosition('P1', 0, 0);
// UI.setTurn(0);
// UI.setTurn(1);

// UI.disableDice();
// UI.enableDice();
// UI.highlightPieces('P1', [0]);
// UI.unhighlightPieces();
// UI.setDiceValue(5);
