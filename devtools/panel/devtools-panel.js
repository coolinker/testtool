

const _port = chrome.runtime.connect({name: "ftt_devtool_panel_" + chrome.devtools.inspectedWindow.tabId});
_port.onMessage.addListener(handleMessage);

function handleMessage(request) {
  console.log("devtool panel handleMessage", request);
  if (request.type === "LAUNCH") {
    document.getElementById("actionList").innerHTML = "";
    return;
  }
  // _port.postMessage({
  //   ...request,
  //   source: "devtoolPanel",
  //   tabId: chrome.devtools.inspectedWindow.tabId,
  // });

  const newDiv = document.createElement("div");
  const { time, source, type, message}  = request;
  newDiv.innerHTML = `<div class="ftt-time">${time}</div>
  <div class="ftt-type">${type}</div>
  <div class="ftt-source">${source}</div>
  <div class="ftt-message">${JSON.stringify(request.message).substr(0, 300)}</div>`;
  newDiv.className = "ftt-line";
  //const newContent = document.createTextNode(request.time + ": " + JSON.stringify(request));
  //newDiv.appendChild(newContent);

  document.getElementById("actionList").appendChild(newDiv);
}

// const scriptToAttach = "document.body.innerHTML = 'Hi from the devtools';";
// document.getElementById("button_message").addEventListener("click", () => {
//   chrome.runtime.sendMessage({
//     tabId: chrome.devtools.inspectedWindow.tabId,
//     script: scriptToAttach
//   });
// });
