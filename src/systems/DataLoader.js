/**
 * Data — global data store populated by BootScene after fetch.
 * All game content passes through here. Tools write to data/ JSON,
 * the engine reads via this module at runtime.
 */
export const Data = {
  game: null,
  characters: null,
  variables: null,
  scenes: {},

  getScene(id) {
    return this.scenes[id] || null;
  },

  getCharacter(id) {
    return this.characters?.[id] || null;
  },

  getDefaultTextSpeed() {
    return this.game?.defaults?.textSpeed || 40;
  }
};
