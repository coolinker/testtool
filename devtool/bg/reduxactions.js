
function handleReduxActions(msg) {
    contentConnections[msg.tabId].postMessage({
        type: "FTT_REDUX_ACTION_PLAY",
        action: {
            type: "RESET",
        }
      });
}

