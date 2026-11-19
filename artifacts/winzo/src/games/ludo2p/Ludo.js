/**
 * Ludo.js — copy of the original game's turn engine (owner: Kunal).
 * Source: C:\Users\Kunal\Desktop\game\ludo-game-using-html-css-and-javascript
 *
 * INTEGRATION CHANGES (minimal — all core rules/animation logic identical):
 *  1. TURN_ORDER: the original hot-seat order [0, 2, 1, 3] becomes [0, 1] for
 *     the 2-player online mode — P1 (blue, bottom-left home) vs P2 (green,
 *     top-right home), the first two players of the original order. P3 (red)
 *     and P4 (yellow) never enter the match: their tokens are hidden so their
 *     homes sit empty and they can never move or be killed.
 *  2. The original has ONE central 3D-dice widget; the 2-player mode has TWO
 *     identical widgets — one beside each player's home (blue / green). Each
 *     widget animates, shows its own Result and is enabled ONLY for its own
 *     player's turn (the other stays disabled). The dice roll transforms,
 *     animation and result text are exactly the original ones, applied to the
 *     acting player's widget.
 *  3. The module-level 3D-dice element queries moved into bindDiceElements(),
 *     called from the constructor (React renders the markup after import).
 *  4. Host hooks: onPosition/onDiceRolled/onTurnChange/onWin callbacks and
 *     canRoll()/canAct() guards let the React page sync state over RTDB and
 *     enforce turns. With no hooks set, behaviour is EXACTLY the original
 *     hot-seat game (guards default to true).
 *  5. alert() on win replaced by the onWin hook (Winggo result screen).
 *  6. destroy() removes all listeners (React unmount / rematch).
 *  7. externalRoll()/applyExternalTurn()/applyExternalPositions() replay the
 *     opponent's writes so both screens show the same dice + step animation.
 */
import { BASE_POSITIONS, HOME_ENTRANCE, HOME_POSITIONS, PLAYERS, SAFE_POSITIONS, START_POSITIONS, STATE, TURNING_POINTS } from './constants.js';
import { UI } from './UI.js';

// 2-player mode: P1 (blue) vs P2 (green) — subset of the original order [0, 2, 1, 3]
const TURN_ORDER = [0, 1];

// one 3D-dice widget per player (bound lazily — see note 3 above)
let dices = null;             // { P1: element, P2: element }
let rollBtns = null;          // { P1: element, P2: element }
let resultDisplays = null;    // { P1: element, P2: element }

function bindDiceElements() {
    if (dices && rollBtns && resultDisplays) return;
    dices = {
        P1: document.querySelector('.containeer-p1 .dice'),
        P2: document.querySelector('.containeer-p2 .dice'),
    };
    rollBtns = {
        P1: document.querySelector('.containeer-p1 .roll'),
        P2: document.querySelector('.containeer-p2 .roll'),
    };
    resultDisplays = {
        P1: document.querySelector('.containeer-p1 .result'),
        P2: document.querySelector('.containeer-p2 .result'),
    };
}

const randomDice = (player) => {
    const random = Math.floor(Math.random() * 6) + 1; // Generates a number between 1 and 6
    rollDice(player, random);
    return random;
}

const rollDice = (player, random) => {
    const dice = dices?.[player];
    if (!dice) return;
    dice.style.animation = 'rolling 1s'; // Set a faster animation duration

    setTimeout(() => {
        // Show the dice face based on the random number
        switch (random) {
            case 1:
                dice.style.transform = 'rotateX(0deg) rotateY(0deg)';
                break;
            case 2:
                dice.style.transform = 'rotateX(-90deg) rotateY(0deg)';
                break;
            case 3:
                dice.style.transform = 'rotateX(0deg) rotateY(90deg)';
                break;
            case 4:
                dice.style.transform = 'rotateX(0deg) rotateY(-90deg)';
                break;
            case 5:
                dice.style.transform = 'rotateX(90deg) rotateY(0deg)';
                break;
            case 6:
                dice.style.transform = 'rotateX(180deg) rotateY(0deg)';
                break;
            default:
                break;
        }

        dice.style.animation = 'none'; // Stop the animation after it completes

        // Display the result on that player's own dice widget
        const display = resultDisplays?.[player];
        if (display) display.textContent = `Result: ${random}`;
    }, 1050); // Slightly more than the animation duration
}

export class Ludo {
    currentPositions = {
        P1: [],
        P2: [],
        P3: [],
        P4: []
    };

    /** Host integration hooks — all optional; defaults reproduce the original game */
    hooks = {
        /** (player, piece, position) after EVERY visual position change */
        onPosition: null,
        /** (diceValue) after a LOCAL roll by the current player */
        onDiceRolled: null,
        /** (playerIndex) after the turn advances locally */
        onTurnChange: null,
        /** (player) when a player got all four tokens home */
        onWin: null,
        /** may the user roll the dice right now? (online turn guard) */
        canRoll: () => true,
        /** may the user act (click pieces / auto-advance) for this player? */
        canAct: () => true,
    };

    _applying = false;   // true while replaying the opponent's state (suppress writes)
    _removers = [];

    _diceValue;
    get diceValue() {
        return this._diceValue;
    }
    set diceValue(value) {
        this._diceValue = value;
        UI.setDiceValue(value);
    }

    _turn;
    get turn() {
        return this._turn;
    }
    set turn(value) {
        this._turn = value;
        UI.setTurn(value);
        this._refreshDice();
    }

    _state;
    get state() {
        return this._state;
    }
    set state(value) {
        this._state = value;

        if (value === STATE.DICE_NOT_ROLLED) {
            UI.unhighlightPieces();
        }
        this._refreshDice();
    }

    /**
     * 2-player dice UI: the CURRENT turn player's own dice is enabled only
     * while the dice is not rolled yet; every other player's dice stays
     * disabled until their turn comes.
     */
    _refreshDice() {
        if (this._turn == null) return;
        const active = PLAYERS[this._turn];
        PLAYERS.forEach((p) => {
            if (p === active && this._state === STATE.DICE_NOT_ROLLED) {
                UI.enableDice(p);
            } else {
                UI.disableDice(p);
            }
        });
        UI.setDiceButton(this._state === STATE.DICE_NOT_ROLLED);
    }

    constructor() {
        console.log('Hello World! Lets play Ludo!');

        bindDiceElements();
        UI.init();

        // Initialize the turn index to -1, so the first call to incrementTurn sets it to the first player
        this.turnIndex = -1;
        this.incrementTurn(); // Start the game with the first player

        this._removers.push(UI.listenRollClick(this.onDiceClick.bind(this)));
        this._removers.push(UI.listenResetClick(this.resetGame.bind(this)));
        this._removers.push(UI.listenPieceClick(this.onPieceClick.bind(this)));

        this.resetGame();
    }

    /** Remove all listeners (React unmount / rematch). */
    destroy() {
        this._removers.forEach((rm) => { try { rm(); } catch {} });
        this._removers = [];
    }

    onDiceClick(player) {
        if (!this.hooks.canRoll()) return; // online guard — original had no visible gate
        // DOM click events arrive as the first argument — only a real player
        // string selects a specific dice; otherwise the current player's dice rolls
        const p = (typeof player === 'string' && PLAYERS.includes(player)) ? player : PLAYERS[this.turn];
        console.log('dice clicked!');
        this.diceValue = randomDice(p); // Animate the dice and set the value
        this.hooks.onDiceRolled?.(this.diceValue);
        this.state = STATE.DICE_ROLLED;
        this.checkForEligiblePieces();
    }

    checkForEligiblePieces() {
        const player = PLAYERS[this.turn];
        const eligiblePieces = this.getEligiblePieces(player);
        if (eligiblePieces.length) {
            // Highlight the pieces
            UI.highlightPieces(player, eligiblePieces);
        } else {
            // Guard: in online mode only the acting client advances the turn;
            // the opponent waits for the mover's turn write (hook default: act)
            if (this.hooks.canAct(player)) this.incrementTurn();
        }
    }

    incrementTurn() {
        // Increment the turn index and follow the turn order
        this.turnIndex = (this.turnIndex + 1) % TURN_ORDER.length;
        this.turn = TURN_ORDER[this.turnIndex];
        this.state = STATE.DICE_NOT_ROLLED;
        this.hooks.onTurnChange?.(this.turn);
    }

    getEligiblePieces(player) {
        return [0, 1, 2, 3].filter(piece => {
            const currentPosition = this.currentPositions[player][piece];

            if (currentPosition === HOME_POSITIONS[player]) {
                return false;
            }

            if (
                BASE_POSITIONS[player].includes(currentPosition) &&
                this.diceValue !== 6
            ) {
                return false;
            }

            if (
                HOME_ENTRANCE[player].includes(currentPosition) &&
                this.diceValue > HOME_POSITIONS[player] - currentPosition
            ) {
                return false;
            }

            return true;
        });
    }

    resetGame() {
        console.log('reset game');
        this.currentPositions = structuredClone(BASE_POSITIONS);
        PLAYERS.forEach(player => {
            [0, 1, 2, 3].forEach(piece => {
                this.setPiecePosition(player, piece, this.currentPositions[player][piece]);
            });
        });
        this.turnIndex = -1; // Start from the first player on reset
        this.incrementTurn(); // Ensure the first player is selected
        this.state = STATE.DICE_NOT_ROLLED;
    }

    onPieceClick(event) {
        const target = event.target;

        if (!target.classList.contains('player-piece') || !target.classList.contains('highlight')) {
            return;
        }
        console.log('piece clicked');

        const player = target.getAttribute('player-id');
        const piece = target.getAttribute('piece');
        this.handlePieceClick(player, piece);
    }

    handlePieceClick(player, piece) {
        if (!this.hooks.canAct(player)) return; // online guard — click only my tokens
        console.log(player, piece);
        const currentPosition = this.currentPositions[player][piece];

        if (BASE_POSITIONS[player].includes(currentPosition)) {
            this.setPiecePosition(player, piece, START_POSITIONS[player]);
            this.state = STATE.DICE_NOT_ROLLED;
            return;
        }

        UI.unhighlightPieces();
        this.movePiece(player, piece, this.diceValue);
    }

    setPiecePosition(player, piece, newPosition) {
        this.currentPositions[player][piece] = newPosition;
        UI.setPiecePosition(player, piece, newPosition);
        if (!this._applying) this.hooks.onPosition?.(player, piece, newPosition);
    }

    movePiece(player, piece, moveBy) {
        const interval = setInterval(() => {
            this.incrementPiecePosition(player, piece);
            moveBy--;

            if (moveBy === 0) {
                clearInterval(interval);

                // Check if player won
                if (this.hasPlayerWon(player)) {
                    // Original had alert() here — the host shows the result screen
                    this.hooks.onWin?.(player);
                    return;
                }

                const isKill = this.checkForKill(player, piece);

                if (isKill || this.diceValue === 6) {
                    this.state = STATE.DICE_NOT_ROLLED;
                    return;
                }

                this.incrementTurn();
            }
        }, 200);
    }

    checkForKill(player, piece) {
        const currentPosition = this.currentPositions[player][piece];
        let kill = false;

        PLAYERS.forEach(opponent => {
            if (opponent !== player) {
                [0, 1, 2, 3].forEach(piece => {
                    const opponentPosition = this.currentPositions[opponent][piece];

                    if (currentPosition === opponentPosition && !SAFE_POSITIONS.includes(currentPosition)) {
                        this.setPiecePosition(opponent, piece, BASE_POSITIONS[opponent][piece]);
                        kill = true;
                    }
                });
            }
        });

        return kill;
    }

    hasPlayerWon(player) {
        return [0, 1, 2, 3].every(piece => this.currentPositions[player][piece] === HOME_POSITIONS[player]);
    }

    incrementPiecePosition(player, piece) {
        this.setPiecePosition(player, piece, this.getIncrementedPosition(player, piece));
    }

    getIncrementedPosition(player, piece) {
        const currentPosition = this.currentPositions[player][piece];

        if (currentPosition === TURNING_POINTS[player]) {
            return HOME_ENTRANCE[player][0];
        } else if (currentPosition === 51) {
            return 0;
        }
        return currentPosition + 1;
    }

    // ─── INTEGRATION: replay helpers (opponent side) ────────────────────────────

    /**
     * Replay the opponent's dice roll on THEIR OWN dice widget: same 3D
     * animation + result display, highlight eligibility — but do NOT emit
     * onDiceRolled (no echo loop).
     */
    externalRoll(player, value) {
        rollDice(player ?? PLAYERS[this.turn], value);
        this._applying = true;
        this.diceValue = value;
        this._applying = false;
        this.state = STATE.DICE_ROLLED;
        this.checkForEligiblePieces();
    }

    /** Replay the opponent's turn change (no local increment). */
    applyExternalTurn(playerIndex) {
        this.turn = playerIndex;
        this.state = STATE.DICE_NOT_ROLLED;
    }

    /** Replay the opponent's positions (kill resets / step-by-step moves). */
    applyExternalPositions(positions) {
        this._applying = true;
        PLAYERS.forEach((player) => {
            [0, 1, 2, 3].forEach((piece) => {
                const incoming = positions?.[player]?.[piece];
                if (incoming != null && incoming !== this.currentPositions[player][piece]) {
                    this.setPiecePosition(player, piece, incoming);
                }
            });
        });
        this._applying = false;
    }

    /** Full reset from the host (rematch / room replay). */
    resetFromState(positions, turnIndex) {
        this._applying = true;
        this.currentPositions = structuredClone(BASE_POSITIONS);
        PLAYERS.forEach(player => {
            [0, 1, 2, 3].forEach(piece => {
                this.setPiecePosition(player, piece, this.currentPositions[player][piece]);
            });
        });
        this._applying = false;
        if (positions) this.applyExternalPositions(positions);
        if (turnIndex != null) {
            this.turnIndex = turnIndex;
            this.turn = TURN_ORDER[turnIndex];
        }
        this.state = STATE.DICE_NOT_ROLLED;
    }
}
