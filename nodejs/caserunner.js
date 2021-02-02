const hash = require('object-hash');
const colors = require('colors/safe');
const { exit } = require('process');
const Diff = require('diff');

const puppeteer = require("puppeteer-core");
const injectContentScript = require("./injectscript");
const loadCase = require("./loadcase");
const { requestToObj, generateStateDelta, jsondiffpatchFilter, deltaConsole, domMutationSummary } = require("./utils");

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

let configs = {
  caseName: "Case0",
  assert: (desc, a0, a1) => {},
  requestFilter: (url) => true,
  matchRequest: (req0, req1) => false,
  // matchRequestAndResponse: (reqUrl, respUrl) => false,
  domMutationFilter: (dm0, dm1) => false,
  reduxActionDeltaFilter: (a0, a1) => false,
}
let _finishResolver;
let browser;
async function run(cfg = {}) {
  configs = {
    ...configs,
    ...cfg,
  };
  const { caseName } = configs;
  browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false, 
    executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    args:["--proxy-server=http://127.0.0.1:8888",
      "--load-extension=C:/gitprj/testtool/devtool",
      "--start-maximized",
      "--offline"],
    ignoreDefaultArgs: ["--disable-extensions","--enable-automation"],
  });

  const jsonObj = await loadCase(caseName);

  REDUX_ACTIONS = jsonObj.REDUX_ACTIONS;
  DOM_MUTATIONS = jsonObj.DOM_MUTATIONS;
  USER_EVENTS = jsonObj.USER_EVENTS;
  RESPONSES = jsonObj.RESPONSES;
  REQUESTS = jsonObj.REQUESTS;
  //fixPrefetchResponses(RESPONSES);

  const page = await browser.newPage();
  const firstPageRequest = REQUESTS[0];
  const pageUrl = firstPageRequest.message.url;
  await page.setRequestInterception(true);
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
  return new Promise((rel, rej) => {
    _finishResolver = rel;
  })
}

function handleHttpTraffic(page) {
  page.on('request', (request) => {    
    try{
      const filter = configs.requestFilter(request.url());
      if (filter) {
        const req = getMatchRequest(request);
        const { hash: hashstr } = req || {};
        if(req) {
          console.log(colors.green("Match request"), hashstr, request.url());
          
          //if(hashstr === "07a0009fccfef9a2f02e35fa8c1cbd446b8df97a") console.log("===========", hashstr, response.body.length);
          //pendingRequests[hashstr] = request;
  
          putRequestPendingQueue(hashstr, request);
  
          //const response = getResponseByHash(hashstr);
          //request.respond(response);
          //   console.log("response", hashstr);
          //  setTimeout(() => {
          //     console.log("----------", request.url())
          //     request.respond(response);
          //     console.log("----------")
          //  }, count * 1000);
          // count++;
          // })(request, response);
  
          
        } else {
          console.log(colors.red("page.on:" + hashstr), request.url());
          console.log(request.headers())
          request.continue();
          //request.abort();
        }
      } else {
        request.continue();
      }
      
    } catch (e) {
      console.log(e);
    }

    resetJobTimer();
  });

  page.on('response', async (response) => {
    console.log("-----------------response done", response.request().url());
  });
}


let _rescheduleTimeout;
let _jobCancelled = false;
const jobInterval = 20;
function resetJobTimer(inerval) {
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

function doNextJob() {
  const job = getNextJob(); 
  if (!job) {
    _finishResolver();
    console.log("doNextJob==============================exit")
    browser.close();
    return;
  }
  const type = job.type; 
  switch (type) {
    case "RESPONSE":
      handleResponseJob(job);
      resetJobTimer(job.nextInterval);
      break;
    case "REQUEST":
      //resetJobTimer();
      break;
  }
}

function matchResponseWithPendingRequest(response) {
  const hash = response.hash;
  const reqs = pendingRequests[hash];
  if (reqs) {
    return reqs;
  }

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

function handleResponseJob(response) {
  const hash = response.hash;
  const reqs = matchResponseWithPendingRequest(response);
  if (reqs) {
    const resp = getResponseByHash(hash);
    console.log(colors.green("Handle Response Job"), hash, resp.url);
    console.log(colors.gray(resp.body.substring && resp.body.substring(0, 200)));
    const req = reqs.shift();
    req.respond(resp);
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
  console.log(colors.grey("RESPONSES " + RESPONSES[0]?.time + RESPONSES[0]?.message.url));
  console.log(colors.grey("REQUESTS " +  REQUESTS[0]?.time + REQUESTS[0]?.message.url));
  console.log(colors.grey("DOM_MUTATIONS " +  DOM_MUTATIONS[0]?.time));
  console.log(colors.grey("REDUX_ACTIONS " +  REDUX_ACTIONS[0]?.time));
  console.log(colors.grey("USER_EVENTS " +  USER_EVENTS[0]?.time));
  
  return sortable[0];
}

function pullArrayElementByHash(hashstr, arr) {
  //for(let i = 0; i < arr.length; i++) {
    const msg = arr[0];
    if (msg.hash === hashstr) {
      const tgt = arr.splice(0, 1);
      return tgt[0];
    }
  //}
}

function getMatchRequest(request) {
  const reqObj = requestToObj(request);
  const hashstr = hash(reqObj);
  const req =  pullArrayElementByHash(hashstr, REQUESTS);
  // console.log("getMatchRequest", hashstr, req);
  if (req) {
    return req;
  } else if (configs.matchRequest(reqObj, REQUESTS[0].message)) {
    return REQUESTS.shift();
  }
  //exit();
}

function getResponseByHash(hashstr) {
  const resp = pullArrayElementByHash(hashstr, RESPONSES)?.message;

  if (resp?.contentType?.indexOf("image") >= 0) {
    resp.body = Buffer.from(resp.body, "base64");
  }

  return resp;
}

function handleMessage(msg) {
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
    if (!delta || configs.reduxActionDeltaFilter(delta)) {
      REDUX_ACTIONS.shift();
      configs.assert(testDesc);
    } else {
      console.log(colors.red("consumeReduxAction Error:"), source.type, source.time);
      deltaConsole.log(delta);
      exit();
      configs.assert(testDesc, actionMsg, source.message);
      cancelJob();
    }
    
    latestSate = source.message.delta ? jsondiffpatchFilter.patch(latestSate, source.message.delta) : latestSate;
  } catch(e) {
    console.log(colors.red("consumeReduxAction ERROR:"), e);
  }
}

function consumeDomMutation(msg) {
  const mutationMsg = msg.message;
  try {
    const source = DOM_MUTATIONS[0];
    const delta = source.checkPoint === CheckPoint.MatchAny
      ? undefined
      : jsondiffpatchFilter.diff(mutationMsg, source.message);
    const testDesc = `DOM Mutation: ${source.hash}`;
    
    if (!delta) {
      DOM_MUTATIONS.shift();
      console.log(colors.green("Match DomMutation:"), source.time);
      configs.assert(testDesc);
    } else {
      console.log(colors.red("Match DomMutation Failure:"), source.time)
      console.log(domMutationSummary(source.message.domMutation));
      //console.log("-------------------------------------------------------------------------------", delta);
      console.log(colors.red(domMutationSummary(mutationMsg.domMutation)));
      //DOM_MUTATIONS.shift();
      //logDomStringDiff(domMutationSummary(source.message.domMutation)[12].target, domMutationSummary(mutationMsg.domMutation)[12].target)
      //deltaConsole.log(delta);
      //exit();   
      configs.assert(testDesc, mutationMsg, source.message);
      //cancelJob();
    }
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

  console.log();
}


module.exports = {
  run,
}