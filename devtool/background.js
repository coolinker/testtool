const devtoolPortPrefix = "ftt_devtool_panel_";
let __FTT_PLAY_STARTED__ = false;

const devtoolConnections = {};
const contentConnections = {};
let debuggerAttachedTabId = null;


chrome.runtime.onConnect.addListener(function(port) {
  console.log("background addListener", port.name);
  const tabId = getPortTabId(port);
  if (port.name == "ftt_content"){
    contentConnections[tabId] = port;
    port.onDisconnect.addListener(() => {
      delete contentConnections[tabId];
    })
    contentConnections[tabId].onMessage.addListener(getMessageHandler(port));
  } else if (port.name.indexOf(devtoolPortPrefix) === 0) {
    devtoolConnections[port.name] = port;
    port.onDisconnect.addListener(() => {
      delete devtoolConnections[port.name];
    })
    port.onMessage.addListener(getMessageHandler(port));
  } 
});

function getMessageHandler(port) {
  if (__FTT_PLAY_STARTED__) {
    return function handlePlayMessage(msg) {
      receivePlayMessage(msg);
    }
  }

  return function handleMessage(msg) {
    receiveMessage(msg);

    if (port.name == "ftt_content") {
      const tabId = port.sender.tab.id;
      const devtoolPanelPort = getDevToolPanelPort(tabId);
      if (devtoolPanelPort) {
        devtoolPanelPort.postMessage(msg);
      } else {
        console.log("no devtool launched!", msg);
      }
    } else if (port.name.indexOf(devtoolPortPrefix) === 0) {

      switch(msg.type) {
        case "RECORD":
          //startRecord(msg.tabId);
          contentConnections[msg.tabId].postMessage(msg);
          break;
        case "EXPORT":
          //exportRecord();
          contentConnections[msg.tabId].postMessage(msg);
          break;
        case "FTT_REDUX_ACTION_PLAY":
          __FTT_PLAY_STARTED__ = true;
          // handleReduxActions(msg);
          //updatePlayStatus(msg.tabId);
          break;

      }

      // if (contentConnections[msg.tabId]) {
      //   contentConnections[msg.tabId].postMessage(msg);
      // } else {
      //   console.log("content not connected!", msg);
      // }
    }
  }
}

function startRecord(tabId) {
  clearMessages();
  //attachDebugger(tabId);
}

function getPortTabId(port) {
  if (port.name == "ftt_content"){
    return port.sender.tab.id;
  } else if (port.name.indexOf(devtoolPortPrefix) === 0) {
    const arr = port.name.split("_");
    return Number(arr[arr.length-1]);
  }
}

function getDevToolPanelPort(tabId) {
  return devtoolConnections[devtoolPortPrefix + tabId];
}

// function updatePlayStatus(tabId) {
//   contentConnections[tabId].postMessage({
//     type: "FTT_REDUX_ACTION_PLAY",
//     source: "background",
//     value: __FTT_PLAY_STARTED__,
//   })
// }

