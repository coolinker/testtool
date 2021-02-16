const colors = require('colors/safe');

const deltaConsole = require('jsondiffpatch').console;
const jsondiffpatch = require('jsondiffpatch').create();
const jsondiffpatchFilter = require('jsondiffpatch').create({
    // propertyFilter: jsonDiffPropertyFilter
  });

function requestToObj(request) {
    const headers = request.headers();
    const contentType = headers["content-type"];
    const method = request.method();
    const data = request.postData();
    const postData = data && method === "POST" && contentType === "application/json" 
        ? JSON.parse(data) : data
    return {
        headers: filterHeaders(headers),
        postData,
        method,
        url: request.url(),
    }
}
  
async function responseToObj(response) {
    const url = response.request().url();
    const status = response.status();
    const responseTime = Date.now();
    const headers = filterHeaders(response.headers());
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
      hash: hash(requestToObj(response.request())), // requestHash(response.request()),
      time: responseTime,
    };
  
    return msg;
}

function filterHeaders(headers) {
    const contentType = headers["content-type"];
    if (contentType?.indexOf("image") > -1) {
        return {"content-type": contentType};
    } else {
        delete headers["user-agent"];
    }

    return headers;
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
        console.log("response.request()", response.request().url());
        const base64 = (await response.buffer()).toString('base64');
        console.log(base64);
    }
    return txt;
}

function generateStateDelta(target, source, useFilter = true) {
    const jdp = useFilter ? jsondiffpatchFilter : jsondiffpatch;
    const delta = jdp.diff(source.state, target.state);
    target.delta = delta;
    delete target.state;
}

function jsonDiffPropertyFilter(name, context) {
    try{
        if (name === "type" && context.left?.type?.indexOf("@@redux/INIT") === 0) {
            //console.log(colors.yellow("Filter attributes"), name, context.childName, context.root?.left?.action?.type);
            return false;
        }
        if (name == "$startDate"
            && (context.childName === "$submission" 
            || context.childName === "$poll"
            || context.parent.childName === "$poll"
            || context.parent.childName === "$submission")) {
            //console.log(colors.yellow("Filter attributes"), name, context.childName, context.parent?.childName);
            return false;
        }
        if (name == "$width"
        && context.childName === "$env" ) {
            //console.log(colors.yellow("Filter attributes"), name, context.childName);
            return false
        } else if (name === "$width") {
            return false;
        }

        if (name === "ordinal" || name === "shuffleOrder") {
            return false;
        }

    } catch (e) {
        console.log(colors.red(e));
    }
    
    return true;
}

function regexTest(str, regs) {
    const arr = regs.map(r => r.test(str));
    return arr.filter(b => b).length === 0;
}

function findMessageByHash(hashstr, arr) {
    for(let i = arr.length -1; i >= 0; i--) {
        const msg = arr[i];
        if (msg.hash === hashstr) {
            return msg;
        }
    }
}

function shiftArrayByHash(hashstr, arr) {
    const msg = arr[0];
    if (msg.hash === hashstr) {
    const tgt = arr.splice(0, 1);
    return tgt[0];
    }
  }
  
function removeArrayElement(ele, arr) {
    for(let i = 0; i < arr.length; i++) {
        const msg = arr[i];
        if (msg === ele) {
        arr.splice(i, 1);
        break;
        }
    }
}

  function firstMessageAfterTime(arr, time) {
    for(let i = 0; i < arr.length; i++) {
      const mtime = arr[i].time;
      if (mtime > time) {
          return arr[i];
      }
    }
  }

  
function getType(obj) {
    return Object.prototype.toString.call(obj).match(/\[\w+ (\w+)\]/)[1].toLowerCase();
  }
  
function hasAdditionalKeys(deltaObj, keyTemplate) {
    const obj = deltaObj.length ? deltaObj[0] : deltaObj;
    if (getType(obj) !== "object" || getType(keyTemplate) !== "object") {
        return false;
    }
    const keys =  Object.keys(obj);
    const templateKeys = Object.keys(keyTemplate);
    const additinal = keys.filter(k => templateKeys.indexOf(k) < 0);

    if (additinal.length > 0) return true;
    for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (hasAdditionalKeys(obj[k], keyTemplate[k])) {
        return true;
        }
    }

    return false;
}

module.exports = {
    requestToObj,
    getResponseBody,
    generateStateDelta,
    deltaConsole,
    jsondiffpatchFilter,
    filterHeaders,
    regexTest,
    shiftArrayByHash,
    removeArrayElement,
    firstMessageAfterTime,
    findMessageByHash,
    hasAdditionalKeys,
    responseToObj,
};