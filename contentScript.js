window.addEventListener('message', function(event) {
  if (event.source !== window) {
    return;
  }

  var message = event.data;

  // Only accept messages that we know are ours
  if (message?.source !== "ftt_page") {
    return;
  }

  _sendMessage(message);
});

const fttStarted = false;

const config = { 
    attributes: true, 
    childList: true, 
    subtree: true,
    characterData: true,
    attributeOldValue: true,
    characterDataOldValue: true,

};

const observer = new MutationObserver((list, options) => {
  _sendMessage({
      source: "ftt_content",
      type: "DOM_MUTATION",
      message: {
        domMutation: mutationRecordsToJson(list),
      },
      time: Date.now(),
    });

});

function mutationRecordsToJson(list) {
  return list.map(record => {
    const { type, target, oldValue, addedNodes, removedNodes, attributeName} = record;
    return {
      type,
      attributeName,
      oldValue,
      target: nodeToJson(target),
      addedNodes: Array.from(addedNodes).map(n => nodeToJson(n)),
      removedNodes: Array.from(removedNodes).map(n => nodeToJson(n)),
    };
  })
};

function nodeToJson(node, depth = 1) {
  const { id, childList, nodeName, className,} = node;
  return {
    id,
    nodeName,
    className,
  }
};

function sendUserEvent(e) {
  //chrome.runtime.sendMessage("contentScript sendUserEvent message");
  _sendMessage({
    source: "ftt_content",
    type: "USER_EVENT",
    message: {
        type:e.type,
    },
    time: Date.now(),
  });
};

function handleOnMessage(msg) {
  console.log("content script handleOnMessage", msg);
  if (msg.type === "LAUNCH") {
    launch();
    console.log("content launch!");
  }
};

function launch() {
  observer.observe(document, config);
  document.addEventListener("mousedown", (e) => {
    sendUserEvent(e);
  },  { capture: true });

  document.addEventListener("keydown", (e) => {
    sendUserEvent(e);
  },  { capture: true });

}

const _sendMessage = msg => {
  console.log("_sendMessge", _port, msg);
  getPort().postMessage(msg);
};

let _port;

const getPort = () => {
  if (!_port) {
    _port = chrome.runtime.connect({name: "ftt_content"});
    _port.onMessage.addListener(handleOnMessage);
  }

  return _port;
  
}

getPort();