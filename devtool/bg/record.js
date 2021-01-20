const REDUX_ACTIONS = [];
const DOM_MUTATIONS = [];
const USER_EVENTS = [];
const HTTPS = [];

function exportRecord() {
    exportJson({
        USER_EVENTS,
        DOM_MUTATIONS,
        REDUX_ACTIONS,
        //HTTPS,
      });
}

function receiveMessage(msg) {
    console.log(msg.type, msg);
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
        default: break;
    }
}
  
function clearMessages() {
    USER_EVENTS.length = 0;
    DOM_MUTATIONS.length = 0;
    REDUX_ACTIONS.length = 0;
    HTTPS.length = 0;
}
  
function exportJson(jsonObj) {
    const link = document.createElement('a');
    const blob = new Blob([JSON.stringify(jsonObj, null, 2)], {type : 'application/json'});
    link.href = URL.createObjectURL(blob);
    link.innerText = 'Open the array URL';
    link.download = 'export.json';
    //document.body.appendChild(link);
    link.click();
}
