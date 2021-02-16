const hash = require('object-hash');
const colors = require('colors/safe');
const { exit } = require('process');
const Diff = require('diff');
const util = require('util');

const puppeteer = require("puppeteer-core");
const injectContentScript = require("./injectscript");
const loadCase = require("./loadcase");
const { requestToObj, generateStateDelta, jsondiffpatchFilter, deltaConsole, regexTest,
  removeArrayElement, shiftArrayByHash, removeElementByHash, responseToObj } = require("./utils");
const { domMutationXPathOnly, domMutationSummary, currentDomMutationGroup } = require("./domutils");
let configs = require('./configs');

process.on('unhandledRejection', error => {
  // Will print "unhandledRejection err is not defined"
  console.log('unhandledRejection', error.message);
});

const  CheckPoint = {
  Key: 0,
  MatchAny: 1,
  Ignore: 2,
}

let REDUX_ACTIONS = [];
let DOM_MUTATIONS = [];
let USER_EVENTS = [];
let RESPONSES = [];
let REQUESTS = [];
const pendingRequests = {};

let _finishResolver;
let browser;
let page;
async function run(cfg = {}) {
  configs = {
    ...configs,
    ...cfg,
  };
  const { caseName } = configs;
  const prm = new Promise((rel, rej) => {
    _finishResolver = rel;
  });

  browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false, 
    executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    args:["--proxy-server=http://127.0.0.1:8888",
      "--load-extension=C:/gitprj/testtool/devtool",
      "--start-maximized"],
    ignoreDefaultArgs: ["--disable-extensions","--enable-automation"],
  });

  const jsonObj = await loadCase(caseName);

  REDUX_ACTIONS = jsonObj.REDUX_ACTIONS;
  DOM_MUTATIONS = jsonObj.DOM_MUTATIONS;
  USER_EVENTS = jsonObj.USER_EVENTS;
  RESPONSES = jsonObj.RESPONSES;
  REQUESTS = jsonObj.REQUESTS;
  //fixPrefetchResponses(RESPONSES);

  page = await browser.newPage();
  const firstPageRequest = REQUESTS[0];
  const pageUrl = firstPageRequest.message.url;
  await page.setRequestInterception(true);
  if (configs.online) {
    await interceptResponse(page);
  }
  await page.setCacheEnabled(false);

  handleHttpTraffic(page);
  await injectContentScript(page, handleMessage);

  await page.goto(pageUrl);
  
  // page.on("console", msg => {
  //   for (let i = 0; i < msg.args().length; ++i)
  //     console.log(`${i}: ${msg.args()[i]}`);
  // });

  // await page.evaluate((x) => {window.postMessage({
  //   source: "play_engine",
  //   type: "FTT_REDUX_ACTION",
  // })}, 1);
  
  //await browser.close();
  return prm;
}

async function interceptResponse(page) {
  const client = await page.target().createCDPSession();
  await client.send("Fetch.enable", {
    patterns:[
      // { 
      //   urlPattern: "https://forms.office.com/*",
      //   requestStage: "Request"}, 
      { 
        urlPattern: "*",
        requestStage: "Response"}],
    });
  
  client.on("Fetch.requestPaused", async ({ requestId, request }) => {
    console.log(`Intercepted ${request.url}`);
    const responseCdp = await client.send("Fetch.getResponseBody", { requestId });
    console.log(`************************Response body for ${requestId} is ${responseCdp.body.length} bytes`);

    await client.send("Fetch.continueRequest", { requestId });
  });

}

function handleHttpTraffic(page) {
  page.on('request', (request) => {    
    try{
      const filter = regexTest(request.url(), configs.noiseUrlRegex);
      if (filter) {
        const req = getMatchRequest(request);
        const { hash: hashstr } = req || {};
        if(req) {
          console.log(colors.green("Match request"), hashstr, request.url().substring(0, 200));
          putRequestPendingQueue(hashstr, request);
          if (configs.online) {
            request.continue();
          }
        } else {
          console.log(colors.red("Match request failure:" + hashstr), request.url());
          console.log(REQUESTS[0]);
          exit();
          //request.abort();
        }
      } else {
        //request.abort();
        request.respond({
          status: 200,
          body: "",
        });
        console.log(colors.gray("ignored page:"+request.url()))
        // request.continue();
      }
      
    } catch (e) {
      console.log(e);
    }

    resetJobTimer();
  });

  page.on('response', async (response) => {
    try{
      const filter = regexTest(response.request().url(), configs.noiseUrlRegex);
      if (filter) {
        console.log("-----------------response done", Date.now(), response.request().url());
        if (configs.online) {
          const respObj = await responseToObj(response, configs.ignoreHeaders);
          
          await handleResponseJob(respObj, false);
        }
      }
    } catch (e) {
      console.log(e)
    }
    
  });
}

let _rescheduleTimeout;
let _jobCancelled = false;

function resetJobTimer(inerval) {
  const jobInterval = 20;
  if (_jobCancelled) {
    return;
  }

  if (inerval) {
    clearTimeout(_rescheduleTimeout);
    _rescheduleTimeout = null;
    setTimeout(doNextJob, inerval);
    return;
  }

  if (_rescheduleTimeout) {
    _rescheduleTimeout.refresh();
  } else {
    _rescheduleTimeout = setTimeout(doNextJob, jobInterval);
  }
}

function cancelJob() {
  clearTimeout(_rescheduleTimeout);
  _jobCancelled = true;
}

async function doNextJob() {
  const job = getNextJob(); 
  if (!job) {
    _finishResolver();
    console.log("doNextJob==============================exit")
    await browser.close();
    return;
  }
  const type = job.type; 
  switch (type) {
    case "RESPONSE":
      if (!configs.online) {
        await handleResponseJob(job, true);
        resetJobTimer();
      } else {
        resetJobTimer(500);
      }
      break;
    case "REQUEST":
      //console.log("--------------------------------doNextJob REQUEST")
      //resetJobTimer(3000);
      break;
    case "USER_EVENT":
      await handleUserEventJob(job);
      break;
  }
}

function matchResponseWithPendingRequest(response) {
  const hash = response.hash;
  const reqs = pendingRequests[hash];
  if (reqs) {
    return reqs;
  }
  console.log(response.hash)

  console.log("hash:", hash, pendingRequests)

  exit();
  // const pendingQueues = reqObject.values(pendingRequests);
  // for (let i = 0; i < pendingQueues.length; i++){
  //   const queue = pendingQueues[i];
  //   if (configs.matchRequestAndResponse(queue[0].url(), response.url)) {
  //     return queue;
  //   }
  // }

  return null;
}

async function handleUserEventJob(userEvent) {
  const { message: {type, target, payload: { key }}} = userEvent;
  removeArrayElement(userEvent, USER_EVENTS);
  const hrefElement = await page.$x(target);
  console.log(colors.blue("handleUserEventJob"), target);
  switch (type) {
    case "click":
      await hrefElement[0]?.click();
      break;
    case "keydown":
      await hrefElement[0]?.type(key);
      break;
    default: ;
  }
}

async function handleResponseJob(response, withRespond = true) {
  const reqs = matchResponseWithPendingRequest(response);
  
  if (reqs) {
    const hash = response.hash;
    const resp = getResponseByHash(hash);

    console.log(colors.green("Handle Response Job"), Date.now(), hash, resp?.url, reqs[0]?.url());
    if (!resp) exit();
    //console.log(colors.gray(resp.body.substring && resp.body.substring(0, 200)));
    const req = reqs.shift();

    if (withRespond) {
      await req.respond(resp);
    }

    if (reqs.length === 0) {
      delete pendingRequests[hash];
    }
  } else {
    console.log(colors.red("requrest not found"), hash, response.message.url);
  }
}

function putRequestPendingQueue(hashstr, request) {
  if (!pendingRequests[hashstr]) {
    pendingRequests[hashstr] = [];
  }

  pendingRequests[hashstr].push(request);
}


function getNextJob() {
  const sortable = [];
  REQUESTS[0] && sortable.push(REQUESTS[0]);
  RESPONSES[0] && sortable.push(RESPONSES[0]);
  REDUX_ACTIONS[0] && sortable.push(REDUX_ACTIONS[0]);
  DOM_MUTATIONS[0] && sortable.push(DOM_MUTATIONS[0]);
  USER_EVENTS[0] && sortable.push(USER_EVENTS[0]);

  sortable.sort((s0, s1) => s0.time - s1.time);
  console.log("getNextJob", sortable.map(s => ({
    time: s.time,
    type: s.type,
  })))
  
  printLeftJobs();
  return sortable[0];
}
function printLeftJobs() {
  console.log(colors.grey("RESPONSES " + RESPONSES[0]?.time + RESPONSES[0]?.message.url.substring(0, 200)));
  console.log(colors.grey("REQUESTS " +  REQUESTS[0]?.time + REQUESTS[0]?.message.url.substring(0, 200)));
  console.log(colors.grey("DOM_MUTATIONS " +  DOM_MUTATIONS[0]?.time));
  console.log(colors.grey("REDUX_ACTIONS " +  REDUX_ACTIONS[0]?.time));
  console.log(colors.grey("USER_EVENTS " +  USER_EVENTS[0]?.time));
}

function removeRequestResponesOfUrl(url, arr) {
  for(let i = 0; i < arr.length; i++) {
    const msg = arr[i].message;
    if (msg.url === url) {
      arr.splice(i, 1);
      break;
    }
  }
}

function getMatchRequest(request) {
  const reqObj = requestToObj(request, configs.ignoreHeaders);
  const hashstr = hash(reqObj);
  
  const req = shiftArrayByHash(hashstr, REQUESTS);
  // console.log("getMatchRequest", hashstr, req);
  if (req) {
    return req;
  } else {
    const target = { 
      message: reqObj,
      type: "REQUEST",
      source: "ftt_node",
    };
    const delta = jsondiffpatchFilter.diff(REQUESTS[0], target);
    console.log("******************getMatchRequest:", delta)
    if (!delta || configs.requestMatcher(delta, target, REQUESTS[0])) {
      return REQUESTS.shift();
    }

    printLeftJobs()
  }
  //exit();
}

function getResponseByHash(hashstr) {
  //const resp = shiftArrayByHash(hashstr, RESPONSES)?.message;
  const resp = removeElementByHash(hashstr, RESPONSES)?.message;

  if (resp?.contentType?.indexOf("image") >= 0) {
    resp.body = Buffer.from(resp.body, "base64");
  }

  return resp;
}

async function handleMessage(msg) {
  console.log("received Message:", msg.time, msg.type, msg.source, msg.message?.action?.type, msg?.hash, msg.message?.url);
  switch(msg.type) {
    case "DOM_MUTATION":
      consumeDomMutation(msg);
      resetJobTimer();
      break;
    case "REDUX_ACTION":
      consumeReduxAction(msg);
      resetJobTimer();
      break;
    case "RESPONSE":
      break;
    case "REQUEST":
      break;
  }
}


let latestSate = {};
function consumeReduxAction(msg) {
  try {
    const actionMsg = msg.message;
    const source = REDUX_ACTIONS[0];
    generateStateDelta(actionMsg, {state: latestSate});
    const delta = jsondiffpatchFilter.diff(actionMsg, source.message);
    const testDesc = `Redux Action: ${actionMsg.action.type}`;
    if (!delta || configs.reduxActionMatcher(delta, msg, source)) {
      REDUX_ACTIONS.shift();
      configs.assert(testDesc);
    } else {
      console.log(colors.red("consumeReduxAction Error:"), source.type, source.time);
      deltaConsole.log(delta);
      exit();
      //configs.assert(testDesc, actionMsg, source.message);
      //cancelJob();
    }
    
    latestSate = source.message.delta ? jsondiffpatchFilter.patch(latestSate, source.message.delta) : latestSate;
    return source;
  } catch(e) {
    console.log(colors.red("consumeReduxAction ERROR:"), e);
  }
}

function consumeDomMutation(msg) {
  try {
    const mutationMsg = msg.message;
    const group = currentDomMutationGroup(DOM_MUTATIONS, RESPONSES, REDUX_ACTIONS, USER_EVENTS);
    
    if (group.length === 0) {
      return;
    }
    let testDesc = `DOM Mutation: ${msg?.hash}`;
    for (let i = 0; i < group.length; i++) {
      const source = group[i];
      const { checkPoint } = source;
      const delta = jsondiffpatchFilter.diff(
        checkPoint === CheckPoint.Key ? mutationMsg : domMutationXPathOnly(mutationMsg),
        checkPoint === CheckPoint.Key ? source?.message : domMutationXPathOnly(source?.message)
        );
      testDesc = `DOM Mutation: ${source?.hash}`;
      
      if (!delta || configs.domMutationMatcher(delta, msg, source)) {
        removeArrayElement(source, DOM_MUTATIONS);
        console.log(colors.green("Match DomMutation:"), source.time);
        configs.assert(testDesc);
        return;
      }
    }

    console.log(colors.red("Match DomMutation Failure:"), group[0].time)
    console.log(domMutationSummary(group[0].message.domMutation));
    //console.log("-------------------------------------------------------------------------------", delta);
    //console.log(colors.red(domMutationSummary(mutationMsg.domMutation)));
    console.log(util.inspect(mutationMsg.domMutation, {showHidden: false, depth: null}))

    //DOM_MUTATIONS.shift();
    //logDomStringDiff(domMutationSummary(source.message.domMutation)[12].target, domMutationSummary(mutationMsg.domMutation)[12].target)
    //deltaConsole.log(delta);
    //exit();   
    configs.assert(testDesc, mutationMsg, group[0].message);
    //cancelJob();
  
    
  } catch (e) {
    console.log("consumeDomMutation error", e)
  }
  
}

function logDomStringDiff(dom1, dom2) {
  const diff = Diff.diffChars(dom1, dom2);
  console.log("logDomStringDiff:", diff.length, diff[0])
  diff.forEach((part) => {
    // green for additions, red for deletions
    // grey for common parts
    const color = part.added ? 'green' :
      part.removed ? 'red' : 'grey';
    if (part.added || part.removed)
      console.log(part)
    else {
      console.log(part.count)
    }
    //process.stderr.write(part.value[color]);
  });

}


module.exports = {
  run,
}