/**
 * @name GameZen
 * @author Théo EwzZer
 * @authorId 384009727253807105
 * @authorLink https://github.com/TheoEwzZer
 * @description Automatically activates Do Not Disturb mode when a game is launched.
 * @donate https://www.paypal.me/TheoEwzZer
 * @source https://github.com/TheoEwzZer/GameZen
 * @updateUrl https://raw.githubusercontent.com/TheoEwzZer/GameZen/main/GameZen.plugin.js
 * @version 1.0.0
 */

/**
 * The module for accessing user settings.
 * @typedef {Object} UserSettingsProtoStore
 * @property {Object} settings - The user settings object.
 */
const UserSettingsProtoStore = BdApi.Webpack.getModule(
  (m) =>
    m && typeof m.getName == "function" && m.getName() == "UserSettingsProtoStore" && m,
  { first: true, searchExports: true }
);

/**
 * Utility functions for updating user settings.
 * @typedef {Object} UserSettingsProtoUtils
 * @property {Function} updateAsync - Asynchronously updates a user setting.
 */
const UserSettingsProtoUtils = BdApi.Webpack.getModule(
  (m) => m?.ProtoClass?.typeName?.endsWith(".PreloadedUserSettings"),
  { first: true, searchExports: true }
);

const ERRORS = {
  ERROR_UPDATING_USER_STATUS: "Error updating user status:",
  ERROR_STARTING_GAMEZEN: "Error starting GameZen:",
  ERROR_STOPPING_GAMEZEN: "Error stopping GameZen:",
  ERROR_GETTING_CURRENT_USER_STATUS: "Error getting current user status:",
  ERROR_UPDATING_USER_STATUS_TO_CURRENT_STATUS:
    "Error updating user status to current status:",
  ERROR_UPDATING_USER_STATUS_TO_DND: "Error updating user status to DND:",
};

module.exports = class GameZen {
  /**
   * Constructor for the GameZen class.
   */
  constructor(meta) {
    this.meta = meta;
    this.unsubscribe = null;
    this.currentUserStatus = null;
    this.defaultSettings = {
      ignoredGames: [],
    };
    this.settings = BdApi.loadData(this.meta.name, "settings") || this.defaultSettings;
  }

  saveSettings() {
    BdApi.saveData(this.meta.name, "settings", this.settings);
  }

  loadSettings() {
    this.settings = BdApi.loadData(this.meta.name, "settings") || this.defaultSettings;
  }

  getSettingsPanel() {
    const { React } = BdApi;
    const { useState } = React;

    const SettingsPanel = ({ settings, saveSettings }) => {
      const [ignoredGames, setIgnoredGames] = useState(settings.ignoredGames || []);
      const [newGame, setNewGame] = useState("");

      const addGame = () => {
        if (newGame.trim().length > 0 && !ignoredGames.includes(newGame.trim())) {
          const updatedGames = [...ignoredGames, newGame.trim()];
          setIgnoredGames(updatedGames);
          settings.ignoredGames = updatedGames;
          saveSettings();
          setNewGame("");
        }
      };

      const removeGame = (gameToRemove) => {
        const updatedGames = ignoredGames.filter((game) => game !== gameToRemove);
        setIgnoredGames(updatedGames);
        settings.ignoredGames = updatedGames;
        saveSettings();
      };

      return React.createElement(
        "div",
        { style: { padding: "10px" } },
        React.createElement("h2", null, "GameZen Settings"),
        React.createElement(
          "div",
          null,
          React.createElement("h3", null, "Ignored Games:"),
          React.createElement(
            "ul",
            null,
            ignoredGames.map((game, index) =>
              React.createElement(
                "li",
                { key: index, style: { marginBottom: "5px" } },
                game,
                React.createElement(
                  "button",
                  {
                    onClick: () => removeGame(game),
                    style: {
                      marginLeft: "10px",
                      padding: "2px 5px",
                      cursor: "pointer",
                    },
                  },
                  "Remove"
                )
              )
            )
          ),
          React.createElement(
            "div",
            { style: { marginTop: "10px" } },
            React.createElement("input", {
              type: "text",
              value: newGame,
              onChange: (e) => setNewGame(e.target.value),
              placeholder: "Add a game",
              style: { padding: "5px", width: "200px" },
            }),
            React.createElement(
              "button",
              {
                onClick: addGame,
                style: {
                  marginLeft: "10px",
                  padding: "5px 10px",
                  cursor: "pointer",
                },
              },
              "Add"
            )
          )
        )
      );
    };

    return React.createElement(SettingsPanel, {
      settings: this.settings,
      saveSettings: this.saveSettings.bind(this),
    });
  }

  /**
   * Updates the remote status to the param `toStatus`
   * @param {('online'|'idle'|'invisible'|'dnd')} toStatus
   */
  updateStatus(toStatus) {
    try {
      UserSettingsProtoUtils.updateAsync(
        "status",
        (statusSetting) => {
          statusSetting.status.value = toStatus;
        },
        0
      );
    } catch (error) {
      console.error(ERRORS.ERROR_UPDATING_USER_STATUS, error);
    }
  }

  /**
   * @returns {string} the current user status
   */
  currentStatus() {
    try {
      return UserSettingsProtoStore.settings.status.status.value;
    } catch (error) {
      console.error(ERRORS.ERROR_GETTING_CURRENT_USER_STATUS, error);
      return "";
    }
  }

  /**
   * Updates the user status to "dnd".
   */
  updateToDnd() {
    try {
      if (this.currentStatus() !== "dnd") {
        this.currentUserStatus = this.currentStatus();
        this.updateStatus("dnd");
      }
    } catch (error) {
      console.error(ERRORS.ERROR_UPDATING_USER_STATUS_TO_DND, error);
    }
  }

  /**
   * Updates the user status to the current status.
   */
  updateToCurrentStatus() {
    try {
      this.updateStatus(this.currentUserStatus);
    } catch (error) {
      console.error(ERRORS.ERROR_UPDATING_USER_STATUS_TO_CURRENT_STATUS, error);
    }
  }

  /**
   * Observes changes in activity and updates the status accordingly.
   */
  observePresenceChanges() {
    const LocalActivityStore = BdApi.Webpack.getStore("LocalActivityStore");

    if (!LocalActivityStore) {
      console.error("LocalActivityStore not found.");
      return;
    }

    const checkActivity = () => {
      try {
        const primaryActivity = LocalActivityStore.getPrimaryActivity();

        if (primaryActivity && primaryActivity.type === 0) {
          if (this.settings.ignoredGames.includes(primaryActivity.name)) {
            return;
          }
          this.updateToDnd();
        } else if (this.currentStatus() === "dnd") {
          this.updateToCurrentStatus();
        }
      } catch (error) {
        console.error("Error checking activity:", error);
      }
    };

    checkActivity();

    this.unsubscribe = LocalActivityStore.addChangeListener(() => {
      setTimeout(checkActivity, 1000); // Add a delay to reduce frequency
    });
  }

  /**
   * Activates Do Not Disturb mode when a game is launched.
   */
  start() {
    try {
      this.loadSettings();
      this.currentUserStatus = this.currentStatus();
      this.observePresenceChanges();
    } catch (error) {
      console.error(ERRORS.ERROR_STARTING_GAMEZEN, error);
    }
  }

  /**
   * Stops the GameZen plugin by removing the activity change listener and updating the user status to the current status.
   */
  stop() {
    try {
      if (this.unsubscribe) {
        this.unsubscribe();
      }
      this.updateToCurrentStatus();
      this.saveSettings();
    } catch (error) {
      console.error(ERRORS.ERROR_STOPPING_GAMEZEN, error);
    }
  }
};
