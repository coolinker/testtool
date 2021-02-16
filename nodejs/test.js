const puppeteer = require("puppeteer-core");

const html = `
  <!doctype html>
  <html>
    <head>
      <meta charset='UTF-8'>
      <title>Test</title>
      <script>
        function main() {
          document.body.addEventListener('click', logClick);
          document.body.addEventListener('mousedown', logClick);
        }

        function logClick() {
          console.log('click');
        }
      </script>
    </head>
    <body onload='main();'>Text.</body>
  </html>`;

// const puppeteer = require('puppeteer');

(async function main() {
  try {
    const browser = await puppeteer.launch({
        defaultViewport: null,
        headless: true, 
        executablePath: "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
    });
    const [page] = await browser.pages();

    await page.goto(`data:text/html,${html}`);

    const cdp = await page.target().createCDPSession();
    const {result} = await cdp.send('Runtime.evaluate', {expression: "document.querySelector('body')"})
	const {listeners} = await cdp.send('DOMDebugger.getEventListeners', {objectId: result.objectId})
    console.log(listeners.length, listeners[0])

    // const nodeObject = (await cdp.send('Runtime.evaluate', {
    //   expression: "document.querySelector('body')",
    //   objectGroup: 'foobar',
    // })).result;
    // const listeners = (await cdp.send('DOMDebugger.getEventListeners', {
    //     objectId: nodeObject.objectId,
    //   })).listeners;

    // const listenerObject = listeners[0].handler;
    // console.log(listeners.length, listeners[1])
    // const listenerName1 = (await cdp.send('Runtime.callFunctionOn', {
    //   functionDeclaration: 'function() { return this.name; }',
    //   objectId: listenerObject.objectId,
    //   returnByValue: true,
    // })).result.value;

    // const listenerName2 = (await cdp.send('Runtime.getProperties', {
    //   objectId: listenerObject.objectId,
    //   ownProperties: true,
    // })).result.find(property => property.name === 'name').value.value;

    // await cdp.send('Runtime.releaseObject', { objectId: listenerObject.objectId });
    // await cdp.send('Runtime.releaseObject', { objectId: nodeObject.objectId });
    // await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'foobar' });

    // console.log(listenerName1);
    // console.log(listenerName2);

    await browser.close();
  } catch (err) {
    console.error(err);
  }
})();