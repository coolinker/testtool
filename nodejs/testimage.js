const puppeteer = require("puppeteer-core");
const hash = require('object-hash');

const injectContentScript = require("./injectscript");
const saveRecords = require("./saverecord");
const { requestToObj, getResponseBody  } = require("./utils");

const officeUrlRegex = /^https?:\/\/([a-zA-Z\d-]+\.){0,}office\./;
const REDUX_ACTIONS = [];
const DOM_MUTATIONS = [];
const USER_EVENTS = [];
const RESPONSES = [];
const REQUESTS = [];

const httpMap = {};
let _response;

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
    console.log("######", url.indexOf(".jpg"), url);
    if (url.indexOf(".jpg") > 0 && _response) {
      console.log("On request: ");
      console.log(_response);
      request.respond(_response);
     
    } else {
      request.continue();
    }
    
    
  });

  page.on('response', async (response) => {
    const url = response.request().url();
    const status = response.status();
    const responseTime = Date.now();
    if (url.indexOf(".jpg") > 0) {

      const headers = response.headers();
      const contentType = headers["content-type"];
      const body = (await response.buffer()).toString('base64');
      const msg = {
        type: "RESPONSE",
        source: "ftt_node",
        message: {
          headers,
          status: 200,
          contentType: "image/png",
          body: Buffer.from(body, "base64")
        },
        hash: hash(requestToObj(response.request())), // requestHash(response.request()),
        time: responseTime,
      };
      //console.log("#####################################", response);
      _response = msg.message;
    }
  });

  //const targets = await browser.targets();
  // page.on("framenavigated",(args) => {
  //   console.log("args:", args);
  // })
  // Define a window.onCustomEvent function on the page.
  
  await page.goto("https://ss0.bdstatic.com/70cFuHSh_Q1YnxGkpoWK1HF6hhy/it/u=2853553659,1775735885&fm=26&gp=0.jpg");
  
  // page.on("console", msg => {
  //   for (let i = 0; i < msg.args().length; ++i)
  //     console.log(`${i}: ${msg.args()[i]}`);
  // });
  
  //await browser.close();
})();

async function handleHttpMessage(page, msg) {
    //recordingStarted && console.log("handleMessage:", msg.time, msg.type, msg.source, msg.message.url);
    
}
