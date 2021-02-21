const hash = require('object-hash');
const { exit } = require('process');

function networkRequestToObject(request, ignoreHeaderKeys) {
  const headers = request.headers;
  const contentType = headers["content-type"];
  const method = request.method;
  const data = request.postData;
  const postData = data && method === "POST" && contentType === "application/json" 
      ? JSON.parse(data) : data
  const re = {
      headers: filterHeaders(headers, ignoreHeaderKeys),
      postData,
      method,
      url: request.url,
  }
  return re;
}

function requestToObj(request, ignoreHeaderKeys) {
  const headers = request.headers();
  const contentType = headers["content-type"];
  const method = request.method();
  const data = request.postData();
  const postData = data && method === "POST" && contentType === "application/json" 
      ? JSON.parse(data) : data
  const re = {
      headers: filterHeaders(headers, ignoreHeaderKeys),
      postData,
      method,
      url: request.url(),
  }
  return re;
}

function toResponseObj({request, responseStatusCode, responseHeaders, body}, ignoreHeaderKeys = []) {
  const url = request.url;
  const status = responseStatusCode;
  const responseTime = Date.now();
  const hashStr = hash(networkRequestToObject(request, ignoreHeaderKeys))
  const headers = filterHeaders(responseHeaders, ignoreHeaderKeys);
  const contentType = responseHeaders["content-type"];
  const msg = {
    type: "RESPONSE",
    source: "ftt_node",
    message: {
      headers,
      status,
      contentType,
      body,
      url,
    },
    hash: hashStr,
    time: responseTime,
  };

  return msg;
}

async function responseToObj(response, ignoreHeaderKeys = []) {
  const url = response.request().url();
  const status = response.status();
  const responseTime = Date.now();
  const hashStr = hash(requestToObj(response.request(), ignoreHeaderKeys))
  const headers = filterHeaders(response.headers(), ignoreHeaderKeys);
  const contentType = headers["content-type"];
  const msg = {
    type: "RESPONSE",
    source: "ftt_node",
    message: {
      headers,
      status,
      contentType,
      body: await getResponseBody(response),
      url,
    },
    hash: hashStr, // requestHash(response.request()),
    time: responseTime,
  };
  return msg;
}

function filterHeaders(headers, ignoreKeys = []) {
  const contentType = headers["content-type"];
  if (contentType?.indexOf("image") > -1) {
      return {"content-type": contentType};
  } else {
      //delete headers["user-agent"];
      ignoreKeys.forEach(k => delete headers[k]);
      return headers;
  }
}

async function getResponseBody(response) {
  const headers = response.headers();
  const status = response.status();

  if (status === 302) return "";

  const contentType = headers["content-type"];

  if (contentType?.indexOf("image") > -1) {
      return (await response.buffer()).toString('base64');
  }
  const txt = await response.text();
  if (txt == "") {
      console.log("**************response.request()", response.request().url());
  }

  return txt;
}

const { firstElementAfterTime } = require("./utils");

function domMutationXPathOnly(domMutation) {
    const m = domMutation.domMutation
    return {
        domMutation: m.map(m => {
            return {
                ...m,
                addedNodes: m?.addedNodes.map(n => Object.keys(n)[0]),
                removedNodes: m?.removedNodes.map(n => Object.keys(n)[0]),
            }
        })
    }
}

function domMutationSummary(domMutation) {
    return domMutation.map(m => {
        return {
            ...m,
            target: m.target.substring(0, 100),
        }
    })
}

// function currentDomMutationGroup(DOM_MUTATIONS, RESPONSES, REDUX_ACTIONS, USER_EVENTS) {
//     if (DOM_MUTATIONS.length === 0) {
//         return [];
//     }

//     const group = [];
//     const resTime = firstElementAfterTime(RESPONSES, DOM_MUTATIONS[0].time)?.time;
//     const redTime = firstElementAfterTime(REDUX_ACTIONS, DOM_MUTATIONS[0].time)?.time;
//     const userTime = firstElementAfterTime(USER_EVENTS, DOM_MUTATIONS[0].time)?.time;
//     for (let i = 0; i < DOM_MUTATIONS.length; i++) {
//       const time = DOM_MUTATIONS[i].time;
//       if ((!resTime || time < resTime)  
//         && (!redTime || time < redTime)
//         && (!userTime || time < userTime)) {
//           console.log(time, "--------------", resTime, redTime, userTime)
//           group.push(DOM_MUTATIONS[i]);
//       } else {
//         break;
//       }
//     }
  
//     return group;
//   }

function currentMessageGroup(targetArr, ...otherTypes) {
  if (targetArr.length === 0) {
      return [];
  }
  const tgtTime = targetArr[0].time;
  let minTime = Infinity;
  otherTypes.forEach(arr => {
    const t = firstElementAfterTime(arr, tgtTime)?.time || minTime
    minTime = Math.min(t, minTime);
  })
  const group = [];  
  for (let i = 0; i < targetArr.length; i++) {
    const time = targetArr[i].time;
    if (time < minTime) {
        group.push(targetArr[i]);
    } else {
      break;
    }
  }

  return group;
}

module.exports = {
  requestToObj,
  filterHeaders,
  responseToObj,
  toResponseObj,
  domMutationXPathOnly,
  domMutationSummary,
  // currentDomMutationGroup,
  currentMessageGroup,
  networkRequestToObject,
};