const { firstMessageAfterTime } = require("./utils");
function domMutationXPathOnly(domMutation) {
    const m = domMutation.domMutation
    return {
        domMutation: m.map(m => {
            return {
                ...m,
                addedNodes: m?.addedNodes.map(n => Object.keys(n)[0]),
                removedNodes: m?.removedNodes.map(n => Object.keys(n)[0]),
            }
        })
    }
}

function domMutationSummary(domMutation) {
    return domMutation.map(m => {
        return {
            ...m,
            target: m.target.substring(0, 100),
        }
    })
}

function currentDomMutationGroup(DOM_MUTATIONS, RESPONSES, REDUX_ACTIONS, USER_EVENTS) {
    if (DOM_MUTATIONS.length === 0) {
        return [];
    }

    const group = [];
    const resTime = firstMessageAfterTime(RESPONSES, DOM_MUTATIONS[0].time)?.time;
    const redTime = firstMessageAfterTime(REDUX_ACTIONS, DOM_MUTATIONS[0].time)?.time;
    const userTime = firstMessageAfterTime(USER_EVENTS, DOM_MUTATIONS[0].time)?.time;
    for (let i = 0; i < DOM_MUTATIONS.length; i++) {
      const time = DOM_MUTATIONS[i].time;
      if ((!resTime || time < resTime)  
        && (!redTime || time < redTime)
        && (!userTime || time < userTime)) {
          group.push(DOM_MUTATIONS[i]);
      } else {
        break;
      }
    }
  
    return group;
  }
  

module.exports = {
    domMutationXPathOnly,
    domMutationSummary,
    currentDomMutationGroup,
};