const puppeteer = require("puppeteer-core");
const hash = require('object-hash');
const colors = require('colors/safe');

const injectContentScript = require("./injectscript");
const saveRecords = require("./saverecord");
const { requestToObj, responseToObj, regexTest, findMessageByHash } = require("./utils");

var myArgs = process.argv.slice(2);

const configs = {
  noiseUrlRegex: [/^https?:\/\/([a-zA-Z\d-]+\.){0,}com\/c\.gif/,
    /^https?:\/\/([a-zA-Z\d-]+\.){0,}net\/forms\/images\/favicon\.ico/,
    /^https?:\/\/browser\.pipe\.aria\.microsoft\.com/,
    /^https?:\/\/web\.vortex\.data\.microsoft\.com/,
  ],
};

const REDUX_ACTIONS = [];
const DOM_MUTATIONS = [];
const USER_EVENTS = [];
const RESPONSES = [];
const REQUESTS = [];

const httpMap = {};
const caseName = myArgs[0] || "Case1";
const startPage = "https://forms.office.com/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR0oaxTShh7lDuDtmCzJnyRZUOTBYOFNKNzBYN1JWNktSQ0VSOTg1NVhJVy4u";
let recordingStarted = false;
let page;
let page_cdp;
(async () => {
  
  const browser = await puppeteer.launch({
    defaultViewport: null,
    headless: false, 
    executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    args:["--proxy-server=http://127.0.0.1:8888",
      "--load-extension=C:/gitprj/testtool/devtool",
      "--start-maximized",
  ],
    ignoreDefaultArgs: ["--disable-extensions","--enable-automation"],
  });
  //const context = await browser.createIncognitoBrowserContext();
  //const page = await context.newPage();
  
  page = await browser.newPage();
  page_cdp = await page.target().createCDPSession();
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const url = request.url();
    if (url === startPage) {
      recordingStarted = true;
    }

    if (regexTest(url, configs.noiseUrlRegex)) {
      console.log(colors.red("recordingStarted"), recordingStarted, request.url(), request.headers())
      const msg = {
        type: "REQUEST",
        source: "ftt_node",
        message: requestToObj(request),
        time: Date.now()
      };
      const hashstr = hash(requestToObj(request));
      httpMap[hashstr] = request;
      msg.hash = hashstr;
      handleHttpMessage(page, msg);
    }
    
    request.continue();
  });

  page.on('response', async (response) => {
    const url = response.request().url();
    if (regexTest(url, configs.noiseUrlRegex)) {
      const msg = await responseToObj(response);
      handleHttpMessage(page, msg);
    }
  });

  //const targets = await browser.targets();
  // page.on("framenavigated",(args) => {
  //   console.log("args:", args);
  // })
  // Define a window.onCustomEvent function on the page.
  
  await injectContentScript(page, handleMessage);

  await page.goto(startPage);
  
  // page.on("console", msg => {
  //   for (let i = 0; i < msg.args().length; ++i)
  //     console.log(`${i}: ${msg.args()[i]}`);
  // });
  
  //await browser.close();
})();

function requestHash(request) {
  for (const [key, value] of Object.entries(httpMap)) {
    
    if (value === request) {
      return key;
    }
  }
}

async function  handleMessage(msg) {
  console.log("handleMessage:", msg.time, msg.type, msg.source,  msg.message?.type, msg.message?.action?.type, msg?.hash, msg.message?.url);

  switch(msg.type) {
    case "RECORD":
      startRecord();
      return;
    case "EXPORT":
      saveRecords(caseName, {
        REDUX_ACTIONS,
        DOM_MUTATIONS,
        USER_EVENTS,
        RESPONSES,
        REQUESTS,
      })
      return;
  }
  
  // if (!filterMessage(msg)) {
  //   return;
  // }
  const oriTime = msg.time;
  const nodeMsg = convertToNodeMessage(msg);
  const curTime = nodeMsg.time;
  if (oriTime !== curTime) {
    //adjustRequestResponseTime(oriTime, curTime);
    //console.log("****************************************", msg.type, oriTime - curTime)
  }
  switch(msg.type) {
    case "USER_EVENT":
      if (recordingStarted) {
        USER_EVENTS.push(nodeMsg);
      }
      break;
    case "DOM_MUTATION":
      recordingStarted && DOM_MUTATIONS.push(nodeMsg);
      break;
    case "REDUX_ACTION":
      recordingStarted && REDUX_ACTIONS.push(nodeMsg);
      break;
    case "RESPONSE":
      if (recordingStarted) {
        RESPONSES.push(nodeMsg);
      }
      break;
    case "REQUEST":
      recordingStarted && REQUESTS.push(nodeMsg);
      break;
  }

  postNodeMessage(nodeMsg);
}

function adjustRequestResponseTime(ori, cur) {
  
  for (let i = REQUESTS.length - 1; i >= 0; i--) {
    const time = REQUESTS[i].time;
    if (time > ori) {
      REQUESTS[i].time += cur - ori;
      const resp = findMessageByHash(REQUESTS[i].hash, RESPONSES);
      console.log("*******************", time, ori, REQUESTS[i].message.url, cur-ori, !!resp)
      if (resp) {
        resp.time += cur - ori;
      }
    } else {
      break;
    }
  }
}

// function filterMessage(msg) {
//   switch (msg.type) {
//     case "RESPONSE":
//     case "REQUEST":
//       return configs.filterRequestAndResponseByUrl(msg.message.url);
//     default: return true;
//   }

// }

function convertToNodeMessage(msg) {
  // const { message: {type: eventType, currentTarget: xpath}} = msg;
  // const expression = `document.evaluate('${xpath}', document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue`;
  // const {result} = await page_cdp.send('Runtime.evaluate', {expression});
  // const {listeners} = await page_cdp.send('DOMDebugger.getEventListeners', {objectId: result.objectId})
  // console.log("***************handleRawUserEvent", eventType, xpath, listeners.length, listeners[0]);
  if (msg.source === "ftt_node") {
    return msg;
  }

  return {
    ...msg,
    source: "ftt_node",
    time: msg.type === "USER_EVENT" ? msg.time : Date.now(),
  };
}

function postNodeMessage(msg) {
  page.evaluate((msg) => window.postMessage(msg), msg);
}

function handleHttpMessage(page, msg) {
    handleMessage(msg);
    //recordingStarted && console.log("handleMessage:", msg.time, msg.type, msg.source, msg.message.url);
    //page.evaluate((msg) => window.postMessage(msg), msg);
}

function startRecord() {
  console.log("*********************************************************************");
  console.log("\nStart recording...");
  console.log("*********************************************************************");
  REDUX_ACTIONS.length = 0;
  DOM_MUTATIONS.length = 0;
  USER_EVENTS.length = 0;
  REQUESTS.length = 0;
  RESPONSES.length = 0;
  recordingStarted = false;
}