const injectContentScript = async (page, messageHandler) => {
    await page.exposeFunction("onFttMessage", messageHandler);
    await page.exposeFunction("node_getTime", () => Date.now());
    await page.evaluateOnNewDocument(() => {
      const observer = new MutationObserver(async (list, options) => {
        const time = await window.node_getTime();
        postMessage({
            source: "ftt_node",
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
            target: nodeToJson(target),
            addedNodes: Array.from(addedNodes).map(n => nodeToJson(n)),
            removedNodes: Array.from(removedNodes).map(n => nodeToJson(n)),
          };
        })
      };
      function nodeToJson(node, depth = 1) {
        return node.outerHTML;
      };
      
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
        postMessage({
          source: "ftt_node",
          type: "USER_EVENT",
          message: {
              type:e.type,
          },
          time: await window.node_getTime(),
        });
      };
      document.addEventListener("mousedown", (e) => {
        sendUserEvent(e);
      },  { capture: true });
    
      document.addEventListener("keydown", (e) => {
        sendUserEvent(e);
      },  { capture: true });

      window.addEventListener("message", async (e) => {
        const msg = e.data;
        if (msg?.type !== "REQUEST" && msg?.type !== "RESPONSE") {
          onFttMessage(msg);
        }
      });
    });
  };

  module.exports = injectContentScript;