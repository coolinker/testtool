

const _port = chrome.runtime.connect({name: "ftt_devtool_panel_" + chrome.devtools.inspectedWindow.tabId});
_port.onMessage.addListener(handleMessage);
let __FTT_PLAY_STARTED__ = false;
let messages = [];
let renderTimeoutObj;
function handleMessage(request) {
  if (request.type === "LAUNCH") {
    document.getElementById("actionList").innerHTML = "";
    return;
  }

  messages.push(request)
  clearTimeout(renderTimeoutObj);
  renderTimeoutObj = setTimeout(render, 200);
  //const newContent = document.createTextNode(request.time + ": " + JSON.stringify(request));
  //newDiv.appendChild(newContent);

}

function render() {
  messages.sort((m, m1) => m.time - m1.time);
  const list = document.getElementById("actionList");
  list.innerHTML = "";
  for(let i=0; i<messages.length; i++) {
    const newDiv = document.createElement("div");
    const { time, source, type, message}  = messages[i];
    newDiv.innerHTML = `<div class="ftt-time">${time}</div>
    <div class="ftt-type">${type}</div>
    <div class="ftt-source">${source}</div>
    <div class="ftt-message">${JSON.stringify(message.url || (message.action && message.action.type) || message).substr(0, 200)}</div>`;
    newDiv.className = "ftt-line";
    list.appendChild(newDiv);
  }
}


document.getElementById("button_start").addEventListener("click", () => {
  document.getElementById("actionList").innerHTML = "";
  messages.length = 0;
  postMessage({
    type: "RECORD"
  });
  setTimeout(() => chrome.devtools.inspectedWindow.reload({ignoreCache: true}), 200);
});

document.getElementById("button_export").addEventListener("click", () => {
  postMessage({
    type: "EXPORT"
  });
});

document.getElementById("button_play").addEventListener("click", () => {
  postMessage({
    type: "FTT_REDUX_ACTION_PLAY",
    value: true,
  });
  __FTT_PLAY_STARTED__ = true;
  chrome.devtools.inspectedWindow.reload({ignoreCache: true});
});

function postMessage(msg) {
  _port.postMessage({
    ...msg,
    source: "ftt_devtool_panel",
    tabId: chrome.devtools.inspectedWindow.tabId,
    time: Date.now()
  });
}

// chrome.devtools.network.onNavigated.addListener(() => {
//   chrome.devtools.inspectedWindow.eval(`window.__FTT_PLAY_STARTED__ = ${__FTT_PLAY_STARTED__}; console.log(window.__FTT_PLAY_STARTED__)`);
// });