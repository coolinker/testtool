
window.addEventListener('message', function(event) {
  if (event.source !== window) {
    return;
  }

  var message = event.data;

  // Only accept messages that we know are ours
  if (!message) {
    return;
  }

  if (message.source === "ftt_node" && (
    message.type === "REDUX_ACTION"
    || message.type === "USER_EVENT"
    || message.type === "REQUEST"
    || message.type === "RESPONSE"
    || message.type === "DOM_MUTATION")) {
    _sendMessage(message);
  }
});

// const config = { 
//     attributes: true, 
//     childList: true, 
//     subtree: true,
//     characterData: true,
//     attributeOldValue: true,
//     characterDataOldValue: true,

// };

// const observer = new MutationObserver((list, options) => {
//   _sendMessage({
//       source: "ftt_content",
//       type: "DOM_MUTATION",
//       message: {
//         domMutation: mutationRecordsToJson(list),
//       },
//       time: Date.now(),
//     });

// });

// function mutationRecordsToJson(list) {
//   return list.map(record => {
//     const { type, target, oldValue, addedNodes, removedNodes, attributeName} = record;
//     return {
//       type,
//       attributeName,
//       oldValue,
//       target: nodeToJson(target),
//       addedNodes: Array.from(addedNodes).map(n => nodeToJson(n)),
//       removedNodes: Array.from(removedNodes).map(n => nodeToJson(n)),
//     };
//   })
// };

// function nodeToJson(node, depth = 1) {
//   // const { id, childList, nodeName, className,} = node;
//   // return {
//   //   id,
//   //   nodeName,
//   //   className,
//   // }
//   return node.outerHTML;
// };

// function sendUserEvent(e) {
//   //chrome.runtime.sendMessage("contentScript sendUserEvent message");
//   _sendMessage({
//     source: "ftt_content",
//     type: "USER_EVENT",
//     message: {
//         type:e.type,
//     },
//     time: Date.now(),
//   });
// };


function _sendMessage(msg) {
  getPort().postMessage(msg);
};

let _port;

function getPort() {
  if (!_port) {
    _port = chrome.runtime.connect({name: "ftt_content"});
    _port.onMessage.addListener(handleOnMessage);
  }

  return _port;
  
}

function handleOnMessage(msg) {
  console.log("content script handleOnMessage", window.__FTT_PLAY_STARTED__, msg);
  if (msg.source === "ftt_devtool_panel") {
    window.postMessage(msg, "*");
  }
};

// function launch() {
//   observer.observe(document, config);
//   document.addEventListener("mousedown", (e) => {
//     sendUserEvent(e);
//   },  { capture: true });

//   document.addEventListener("keydown", (e) => {
//     sendUserEvent(e);
//   },  { capture: true });

// }

getPort();
//launch();