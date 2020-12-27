const devtoolPortPrefix = "ftt_devtool_panel_";

const devtoolConnections = {};
const contentConnections = {};
const debuggerAttachedTabId = null;

const REDUX_ACTIONS = [];
const DOM_MUTATIONS = [];
const USER_EVENTS = [];
const HTTPS = [];

chrome.runtime.onConnect.addListener(function(port) {
  console.log("background addListener", port);
  const tabId = getPortTabId(port);
  if (port.name == "ftt_content"){
    contentConnections[tabId] = port;
    attachDebugger(tabId);
    port.onDisconnect.addListener(() => {
      delete contentConnections[tabId];
    })
    
    port.onMessage.addListener(getMessageHandler(port));

  } else if (port.name.indexOf(devtoolPortPrefix) === 0) {
    devtoolConnections[port.name] = port;
    port.onDisconnect.addListener(() => {
      delete devtoolConnections[port.name];
    })
    port.onMessage.addListener(getMessageHandler(port));
  } 

  if (contentConnections[tabId] && getDevToolPanelPort(tabId)) {
    const launchMsg = {
      source: "background",
      type: "LAUNCH",
      time: Date.now(),
    };
    getDevToolPanelPort(tabId).postMessage(launchMsg);
    contentConnections[tabId].postMessage(launchMsg);
  }
});

function getMessageHandler(port) {
  return function handleMessage(msg) {
    actionReceived(msg);

    if (port.name == "ftt_content") {
      const tabId = port.sender.tab.id;
      const devtoolPanelPort = getDevToolPanelPort(tabId);
      if (devtoolPanelPort) {
        devtoolPanelPort.postMessage(msg);
      } else {
        console.log("no devtool launched!", msg);
      }
    } else if (port.name.indexOf(devtoolPortPrefix) === 0) {
      if (contentConnections[msg.tabId]) {
        contentConnections[msg.tabId].postMessage(msg);
      } else {
        console.log("content not connected!", msg);
      }
    }
    
  }
}

function actionReceived(msg) {
  switch(msg.type) {
    case "USER_EVENT":
      USER_EVENTS.push(msg);
      break;
    case "DOM_MUTATION":
      DOM_MUTATIONS.push(msg);
      break;
    case "REDUX_ACTION":
      REDUX_ACTIONS.push(msg);
    case "HTTP_REQUEST":
    case "HTTP_RESPONSE":
    case "HTTP_RESPONSE_BODY":
      HTTPS.push(msg);
      break;

  }
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

function attachDebugger(tabId) {
  if (debuggerAttachedTabId === tabId) {
    return;
  }
  if (debuggerAttachedTabId) {
    chrome.debugger.attach({ tabId });
  }

  chrome.debugger.attach({ tabId }, "1.0", onAttach.bind(null, tabId));
  chrome.debugger.sendCommand({tabId:tabId}, "Fetch.enable", {patterns:[{ 
    urlPattern: "https://forms.office.com/*",
    requestStage: "Request"}, { 
      urlPattern: "https://forms.office.com/*",
      requestStage: "Response"}]});
  chrome.debugger.onEvent.addListener(onEvent);
  debuggerAttachedTabId = tabId;
}

function onAttach(debuggeeId) {
  if (chrome.runtime.lastError) {
    alert(chrome.runtime.lastError.message);
    return;
  }
}

function onEvent(debuggeeId, message, params) {
  const tabId = debuggeeId.tabId;
  
  if (message === "Fetch.requestPaused") {
    handleRequestPaused(tabId, params.responseStatusCode ? "HTTP_RESPONSE" : "HTTP_REQUEST", params);
    if(params.responseStatusCode) {// This is a response
      chrome.debugger.sendCommand({tabId}, "Fetch.getResponseBody", {requestId: params.requestId}, (body) => {
        console.log("getResponseBody-----------------------------", body);
        handleRequestPaused(tabId, "HTTP_RESPONSE_BODY", {...params, body});
        // chrome.debugger.sendCommand({tabId}, "Fetch.continueRequest", {requestId: params.requestId}, (body) => {
        //   console.log("continueRequest-----------------------------", body);
        // });
      });
    }

    chrome.debugger.sendCommand({tabId}, "Fetch.continueRequest", {requestId: params.requestId}, (body) => {
      console.log("continueRequest-----------------------------", body);
    });
     
  } 
}

function handleRequestPaused(tabId, type, params) {
  getDevToolPanelPort(tabId).postMessage({
    type,
    source: "background",
    message: params,
    time: Date.now(),
  })
}