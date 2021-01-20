const hash = require('object-hash');
const colors = require('colors/safe');
const { exit } = require('process');

const puppeteer = require("puppeteer-core");
const injectContentScript = require("./injectscript");
const loadCase = require("./loadcase");
const { requestToObj, generateStateDelta, jsondiffpatchFilter, deltaConsole } = require("./utils");

let REDUX_ACTIONS = [];
let DOM_MUTATIONS = [];
let USER_EVENTS = [];
let RESPONSES = [];
let REQUESTS = [];
const pendingRequests = {};

(async () => {
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false, 
    executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    args:["--proxy-server=http://127.0.0.1:8888",
      "--load-extension=C:/gitprj/testtool/devtool",
      "--start-maximized",
      "--offline"],
    ignoreDefaultArgs: ["--disable-extensions","--enable-automation"],
  });

  const jsonObj = await loadCase("Case 0");

  REDUX_ACTIONS = jsonObj.REDUX_ACTIONS;
  DOM_MUTATIONS = jsonObj.DOM_MUTATIONS;
  USER_EVENTS = jsonObj.USER_EVENTS;
  RESPONSES = jsonObj.RESPONSES;
  REQUESTS = jsonObj.REQUESTS;


  const page = await browser.newPage();
  const firstPageRequest = REQUESTS[0];
  const pageUrl = firstPageRequest.message.url;
  await page.setRequestInterception(true);
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
})();

function handleHttpTraffic(page) {
  page.on('request', (request) => {
    const hashstr = hash(requestToObj(request));
    
    try{
      const req = getRequestByHash(hashstr);
      if(req) {
        console.log(colors.green("Match request"), hashstr, request.url());
        
        //if(hashstr === "07a0009fccfef9a2f02e35fa8c1cbd446b8df97a") console.log("===========", hashstr, response.body.length);
        pendingRequests[hashstr] = request;
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
      }
    } catch (e) {
      console.log(hashstr, e);
    }

    resetJobTimer();
  });

  page.on('response', async (response) => {
    console.log("-----------------response done", response.request().url());
  });
}


let _rescheduleTimeout;
function resetJobTimer() {
  if (_rescheduleTimeout) {
    _rescheduleTimeout.refresh();
  } else {
    _rescheduleTimeout = setTimeout(doNextJob, 1000);
  }
}

function doNextJob() {
  const job = getNextJob(); 
  const type = job.type; 
  switch (type) {
    case "RESPONSE":
      handleResponseJob(job);
      //setInterval(doNextJob, 3000);
      resetJobTimer();
      break;
  }
}

function handleResponseJob(response) {
  const hash = response.hash;
  const req = pendingRequests[hash];
  if (req) {
    const resp = getResponseByHash(hash);
    console.log(colors.green("handleResponseJob"), hash, response.message.url);

    req.respond(resp);
    delete pendingRequests[hash];
  } else {
    console.log(colors.red("requrest not found"), hash, response.message.url);
  }
}

function getNextJob() {
  const sortable = [];
  RESPONSES[0] && sortable.push(RESPONSES[0]);
  REDUX_ACTIONS[0] && sortable.push(REDUX_ACTIONS[0]);
  DOM_MUTATIONS[0] && sortable.push(DOM_MUTATIONS[0]);
  USER_EVENTS[0] && sortable.push(USER_EVENTS[0]);

  sortable.sort((s0, s1) => s0.time - s1.time);
  console.log("getNextJob", sortable.map(s => ({
    time: s.time,
    type: s.type,
  })))
  console.log("RESPONSES", RESPONSES[0]?.time,RESPONSES[0]?.message.url);
  console.log("REQUESTS", REQUESTS[0]?.time,REQUESTS[0]?.message.url);
  console.log("DOM_MUTATIONS", DOM_MUTATIONS[0]?.time);
  console.log("REDUX_ACTIONS", REDUX_ACTIONS[0]?.time);
  console.log("USER_EVENTS", USER_EVENTS[0]?.time);

  return sortable[0];
}

function pullArrayElementByHash(hashstr, arr) {
  for(let i = 0; i < arr.length; i++) {
    const msg = arr[i];
    if (msg.hash === hashstr) {
      const tgt = arr.splice(i, 1);
      return tgt[0].message;
    }
  }
  console.log("pullArrayElementByHash not found", hashstr);
}

function getRequestByHash(hashstr) {
  return pullArrayElementByHash(hashstr, REQUESTS);
}

function getResponseByHash(hashstr) {
  return pullArrayElementByHash(hashstr, RESPONSES);
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
    if (!delta) {
      
    } else {
      console.log(colors.red("consumeReduxAction Error:"), source.type, source.time);
      deltaConsole.log(delta);
      // exit();
    }
    REDUX_ACTIONS.shift();
    latestSate = source.message.delta ? jsondiffpatchFilter.patch(latestSate, source.message.delta) : latestSate;
  } catch(e) {
    console.log(colors.red("consumeReduxAction ERROR:"), e);
  }
}

function consumeDomMutation(msg) {
  const mutationMsg = msg.message;
  try {
    const source = DOM_MUTATIONS[0];
    const delta = jsondiffpatchFilter.diff(mutationMsg, source.message);

    if (!delta) {
      DOM_MUTATIONS.shift();
      console.log(colors.green("Match DomMutation:"), source.time);
    } else {
      console.log(colors.red("Match DomMutation Failure:"), source.time)
      deltaConsole.log(delta);
      exit();      
    }
  } catch (e) {
    console.log("consumeDomMutation error", e)
  }
  
}