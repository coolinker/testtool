
function attachDebugger(tabId) {
    if (debuggerAttachedTabId === tabId) {
      return;
    }
    if (debuggerAttachedTabId) {
      chrome.debugger.detach({ debuggerAttachedTabId });
    }
  
    chrome.debugger.attach({ tabId }, "1.0", onAttach.bind(null, tabId));
    chrome.debugger.sendCommand({tabId:tabId}, "Fetch.enable", {patterns:[{ 
      urlPattern: "https://*.office.*/*",
      requestStage: "Request"}, { 
      urlPattern: "https://*.office.*/*",
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
      //console.log("request: ", params.request.url);
          
      handleFetchEvents(tabId, params.responseStatusCode ? "HTTP_RESPONSE" : "HTTP_REQUEST", params);
      if(params.responseStatusCode) {// This is a response
        chrome.debugger.sendCommand({tabId}, "Fetch.getResponseBody", {requestId: params.requestId}, (body) => {
          //console.log("getResponseBody-----------------------------", body);
          handleFetchEvents(tabId, "HTTP_RESPONSE_BODY", {...params, body});
          // chrome.debugger.sendCommand({tabId}, "Fetch.continueRequest", {requestId: params.requestId}, (body) => {
          //   console.log("continueRequest-----------------------------", body);
          // });
        });
      }
  
      chrome.debugger.sendCommand({tabId}, "Fetch.continueRequest", {requestId: params.requestId}, (body) => {
        //console.log("continueRequest-----------------------------", body);
      });
       
    } 
  }
  
  function handleFetchEvents(tabId, type, params) {
    const msg = {
      type,
      source: "background",
      message: params,
      time: Date.now(),
    };
    receiveMessage(msg);
    getDevToolPanelPort(tabId).postMessage(msg)
  }
  