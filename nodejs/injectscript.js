const injectContentScript = async (page, messageHandler) => {
    await page.exposeFunction("onFttMessage", messageHandler);
    await page.evaluateOnNewDocument(() => {
      const observer = new MutationObserver(async (list, options) => {
        const time = Date.now();
        postMessage({
            source: "ftt_inject",
            type: "DOM_MUTATION",
            message: {
              domMutation: mutationRecordsToJson(list),
            },
            time,
          });
      });

      function mutationRecordsToJson(list) {
        return list.map(record => {
          const { type, target, oldValue, addedNodes, removedNodes, attributeName} = record;
          return {
            type,
            attributeName,
            oldValue,
            target: getXPathForElement(target),
            addedNodes: Array.from(addedNodes).map(n => nodeToJson(n)),
            removedNodes: Array.from(removedNodes).map(n => nodeToJson(n)),
          };
        })
      };
      function nodeToJson(node, depth = 1) {
        return {
          [getXPathForElement(node)]: node.outerHTML,
        }
      };
      
      function getElementByXpath(path) {
        return document.evaluate(path, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
      }

      function getXPathForElement(element) {
        const idx = (sib, name) => sib 
            ? idx(sib.previousElementSibling, name||sib.localName) + (sib.localName == name)
            : 1;
        const segs = elm => !elm || elm.nodeType !== 1 
            ? ['']
            : false && elm.id && document.getElementById(elm.id) === elm
                ? [`//*[@id='${elm.id}']`] //[`id("${elm.id}")`]
                : [...segs(elm.parentNode), `${elm.localName.toLowerCase()}[${idx(elm)}]`];
        return segs(element).join('/');
      }

      const config = { 
        attributes: true, 
        childList: true, 
        subtree: true,
        characterData: true,
        attributeOldValue: true,
        characterDataOldValue: true,
      };

      observer.observe(document, config);
      
      async function sendUserEvent(e) {
        const time = Date.now();
        postMessage({
          source: "ftt_inject",
          type: "USER_EVENT",
          message: {
              type:e.type,
              payload: {
                key: e.key,
                shiftKey: e.shiftKey,
              },
              target: getXPathForElement(e.target),
          },
          time,
        });
      };
      // document.addEventListener("mousedown", (e) => {
      //   sendUserEvent(e);
      // },  { capture: true });
      
      // document.addEventListener("mouseup", (e) => {
      //   sendUserEvent(e);
      // },  { capture: true });

      document.addEventListener("click", (e) => {
        sendUserEvent(e);
      },  { capture: true });

      // document.addEventListener("keydown", (e) => {
      //   sendUserEvent(e);
      // },  { capture: true });

      // document.addEventListener("keyup", (e) => {
      //   sendUserEvent(e);
      // },  { capture: true });

      document.addEventListener("keydown", (e) => {
        sendUserEvent(e);
      },  { capture: true });

      window.addEventListener("message", async (e) => {
        const msg = e.data;
        if (msg?.source !== "ftt_node") {
          await onFttMessage(msg);
        }
      });
    });
  };

  module.exports = injectContentScript;