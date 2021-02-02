const puppeteer = require("puppeteer-core");
const hash = require('object-hash');
const colors = require('colors/safe');

const injectContentScript = require("./injectscript");
const saveRecords = require("./saverecord");
const { requestToObj, getResponseBody, filterHeaders } = require("./utils");

const officeUrlRegex = /^https?:\/\/([a-zA-Z\d-]+\.){0,}office\./;
const REDUX_ACTIONS = [];
const DOM_MUTATIONS = [];
const USER_EVENTS = [];
const RESPONSES = [];
const REQUESTS = [];

const httpMap = {};
const caseName = "Case1";
const startPage = "https://forms.office.com/Pages/ResponsePage.aspx?id=v4j5cvGGr0GRqy180BHbR0oaxTShh7lDuDtmCzJnyRZUNlU3R044MlQ4SDlWV0FWNlNOQ09ISDdOTi4u&light=1";
let recordingStarted = false;

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
  
  const page = await browser.newPage();
  await page.setRequestInterception(true);

  page.on('request', (request) => {
    const url = request.url();
    if (url === startPage) {
      recordingStarted = true;
    }

    if (true || officeUrlRegex.test(url)) {
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
    const status = response.status();
    const responseTime = Date.now();
    if (true || officeUrlRegex.test(url)) {
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

function handleMessage(msg) {
  console.log("handleMessage:", msg.time, msg.type, msg.source, msg.message?.action?.type, msg?.hash, msg.message?.url);

  switch(msg.type) {
    case "RECORD":
      startRecord();
      break;
    case "EXPORT":
      saveRecords(caseName, {
        REDUX_ACTIONS,
        DOM_MUTATIONS,
        USER_EVENTS,
        RESPONSES,
        REQUESTS,
      })
      break;
    case "DOM_MUTATION":
      msg.hash = hash(msg.message);
      recordingStarted && DOM_MUTATIONS.push(msg);
      break;
    case "REDUX_ACTION":
      recordingStarted && REDUX_ACTIONS.push(msg);
      break;
    case "RESPONSE":
      if (recordingStarted) {
        RESPONSES.push(msg);
      }
      break;
    case "REQUEST":
      recordingStarted && REQUESTS.push(msg);
      break;
  }

}

async function handleHttpMessage(page, msg) {
    handleMessage(msg);
    //recordingStarted && console.log("handleMessage:", msg.time, msg.type, msg.source, msg.message.url);
    page.evaluate((msg) => window.postMessage(msg), msg);
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